import fs from "fs";
import path from "path";
import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin user management", () => {
  test("Admin creates a user with username and it appears in the list", async ({ adminPage }) => {
    // Navigate to admin users page
    await adminPage.goto("/admin/users");
    await expect(adminPage.getByText("Users")).toBeVisible();

    // Click Create User button
    await adminPage.getByRole("button", { name: "Create User" }).click();

    // Fill in the create user dialog
    await adminPage.getByLabel("First Name").fill("Parity");
    await adminPage.getByLabel("Last Name").fill("User");
    await adminPage.getByLabel("Username").fill("parityuser");
    await adminPage.getByLabel("Email").fill("parityuser@example.com");
    await adminPage.getByLabel("Password").fill("Test1234!");
    await adminPage.getByLabel("Role").selectOption("user");

    // Submit
    await adminPage.getByRole("button", { name: "Create" }).click();

    // Wait for the dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new user appears in the list
    await expect(adminPage.getByText("parityuser@example.com")).toBeVisible();
    await expect(adminPage.getByText("parityuser")).toBeVisible();
    await expect(adminPage.getByText("Parity User")).toBeVisible();

    // Take screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-6-admin-create-user.png`,
      fullPage: true,
    });
  });

  test("Non-admin user is blocked from /admin/users", async ({ authenticatedPage }) => {
    // Navigate to admin users page as a regular user
    const response = await authenticatedPage.goto("/admin/users");

    // Should be redirected to /unauthorized
    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly: POST /api/admin/users should return 403
    const apiResponse = await authenticatedPage.request.post("/api/admin/users", {
      data: {
        email: "blocked-user@example.com",
        password: "Test1234!",
        username: "blockeduser",
        firstname: "Blocked",
        lastname: "User",
        role: "user",
      },
    });

    expect(apiResponse.status()).toBe(403);

    // Capture API response as JSON evidence
    const responseBody = await apiResponse.json();
    const evidencePath = path.resolve(process.cwd(), `${EVIDENCE_DIR}/task-6-nonadmin-blocked.json`);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(
        {
          scenario: "Non-admin blocked from user creation",
          method: "POST",
          endpoint: "/api/admin/users",
          status: apiResponse.status(),
          response: responseBody,
          timestamp: new Date().toISOString(),
        },
        null,
        2,
      ),
    );
  });
});
