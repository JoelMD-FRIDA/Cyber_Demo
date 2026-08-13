import { test, expect } from "./fixtures";
import { hasAdminE2EConfig } from "./config";

test.describe("Admin user management", () => {
  test.skip(!hasAdminE2EConfig, "Configure a dedicated Supabase test project for admin E2E tests.");
  test("Admin creates a user with username and it appears in the list", async ({ adminPage }) => {
    // Navigate to admin users page
    await adminPage.goto("/admin/users");
    await expect(adminPage.getByText(/Benutzer|Users/).first()).toBeVisible();

    // Click the add-user button (the UI follows the selected locale).
    await adminPage.getByRole("button", { name: /add|hinzufügen/i }).click();

    // Fill in the create user dialog
    await adminPage.getByLabel(/Vorname|First name/i).fill("Parity");
    await adminPage.getByLabel(/Nachname|Last name/i).fill("User");
    await adminPage.getByLabel(/Benutzername|Username/i).fill("parityuser");
    await adminPage.getByLabel(/E-Mail-Adresse|Email address/i).fill("parityuser@example.com");
    await adminPage.getByLabel(/Passwort|Password/i).fill("Test1234!");
    await adminPage.getByLabel(/Rolle|Role/i).selectOption("user");

    // Submit
    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();

    // Wait for the dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new user appears in the list
    await expect(adminPage.getByText("parityuser@example.com")).toBeVisible();
    await expect(adminPage.getByText("parityuser")).toBeVisible();
    await expect(adminPage.getByText("Parity User")).toBeVisible();

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

  });
});
