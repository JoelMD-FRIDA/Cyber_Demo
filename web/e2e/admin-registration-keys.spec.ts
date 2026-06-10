import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin registration key management", () => {
  test("Admin creates a registration key and it appears in the list", async ({ adminPage }) => {
    // Navigate to admin registration keys page
    await adminPage.goto("/admin/registration-keys");
    await expect(adminPage.getByText("Registration Keys")).toBeVisible();

    // Click Create Key button
    await adminPage.getByRole("button", { name: "Create Key" }).click();

    // Fill in the create dialog
    await adminPage.getByLabel("Code").fill("TEST-KEY-001");
    await adminPage.getByLabel("Total Slots").fill("5");
    await adminPage.getByLabel("Company").fill("TestCorp");
    await adminPage.getByLabel("Company Domain").fill("testcorp.com");

    // Submit
    await adminPage.getByRole("button", { name: "Create" }).click();

    // Wait for the dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new key appears in the list
    await expect(adminPage.getByText("TEST-KEY-001")).toBeVisible();
    await expect(adminPage.getByText("TestCorp")).toBeVisible();
    await expect(adminPage.getByText("testcorp.com")).toBeVisible();
    await expect(adminPage.getByText("0 / 5")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-admin-create-registration-key.png`,
      fullPage: true,
    });
  });

  test("Admin can create key with expiry and see status", async ({ adminPage }) => {
    await adminPage.goto("/admin/registration-keys");
    await expect(adminPage.getByText("Registration Keys")).toBeVisible();

    await adminPage.getByRole("button", { name: "Create Key" }).click();
    await adminPage.getByLabel("Code").fill("EXPIRING-KEY");
    await adminPage.getByLabel("Total Slots").fill("1");
    await adminPage.getByLabel("Expires At").fill("2099-12-31");

    await adminPage.getByRole("button", { name: "Create" }).click();
    await adminPage.waitForTimeout(1000);

    await expect(adminPage.getByText("EXPIRING-KEY")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-admin-create-key-with-expiry.png`,
      fullPage: true,
    });
  });

  test("Non-admin user is blocked from /admin/registration-keys", async ({ authenticatedPage }) => {
    // Navigate as a regular user
    const response = await authenticatedPage.goto("/admin/registration-keys");

    // Should be redirected to /unauthorized
    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly
    const apiResponse = await authenticatedPage.request.post("/api/admin/registration-keys", {
      data: {
        code: "BLOCKED-KEY",
        totalSlots: 5,
      },
    });

    expect(apiResponse.status()).toBe(403);
  });
});
