import { test, expect } from "./fixtures";
import { hasAdminE2EConfig } from "./config";

test.describe("Admin registration key management", () => {
  test.skip(!hasAdminE2EConfig, "Configure a dedicated Supabase test project for admin E2E tests.");
  test("Admin creates a registration key and it appears in the list", async ({ adminPage }) => {
    // Navigate to admin registration keys page
    await adminPage.goto("/admin/registration-keys");
    await expect(adminPage.getByText(/Registrierungsschlüssel|Registration keys/i).first()).toBeVisible();

    // Click the add-key button (the UI follows the selected locale).
    await adminPage.getByRole("button", { name: /add|hinzufügen/i }).click();

    // Fill in the create dialog
    await adminPage.getByLabel("Code").fill("TEST-KEY-001");
    await adminPage.getByLabel(/Nutzung|Usage/i).fill("5");
    await adminPage.getByLabel(/Unternehmen|Company/i).fill("TestCorp");
    await adminPage.getByLabel(/Unternehmensdomain|Company domain/i).fill("testcorp.com");

    // Submit
    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();

    // Wait for the dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new key appears in the list
    await expect(adminPage.getByText("TEST-KEY-001")).toBeVisible();
    await expect(adminPage.getByText("TestCorp")).toBeVisible();
    await expect(adminPage.getByText("testcorp.com")).toBeVisible();
    await expect(adminPage.getByText("0 / 5")).toBeVisible();

  });

  test("Admin can create key with expiry and see status", async ({ adminPage }) => {
    await adminPage.goto("/admin/registration-keys");
    await expect(adminPage.getByText(/Registration Keys|Registrierungsschlüssel/i)).toBeVisible();

    await adminPage.getByRole("button", { name: /add|hinzufügen/i }).click();
    await adminPage.getByLabel("Code").fill("EXPIRING-KEY");
    await adminPage.getByLabel(/Nutzung|Usage/i).fill("1");
    await adminPage.getByLabel(/läuft ab|expires/i).fill("2099-12-31");

    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();
    await adminPage.waitForTimeout(1000);

    await expect(adminPage.getByText("EXPIRING-KEY")).toBeVisible();

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
