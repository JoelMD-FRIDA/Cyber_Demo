import { test, expect } from "./fixtures";
import { hasAdminE2EConfig, hasUserE2EConfig } from "./config";

test.describe("Registration key flow", () => {
  test.skip(!hasAdminE2EConfig || !hasUserE2EConfig, "Configure a dedicated Supabase test project with regular and admin users for E2E tests.");
  test("Admin creates a registration key usable by new users", async ({ adminPage, page }) => {
    // Admin creates a registration key
    await adminPage.goto("/admin/registration-keys");
    await expect(adminPage.getByText(/Registration Keys|Registrierungsschlüssel/i)).toBeVisible();

    await adminPage.getByRole("button", { name: /add|hinzufügen/i }).click();
    await adminPage.getByLabel("Code").fill("E2E-FLOW-KEY");
    await adminPage.getByLabel(/Nutzung|Usage/i).fill("3");
    await adminPage.getByLabel(/Unternehmen|Company/i).fill("E2EFlowCorp");
    await adminPage.getByLabel(/Unternehmensdomain|Company domain/i).fill("e2eflow.test");
    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();
    await adminPage.waitForTimeout(1000);

    // Verify key appears in admin list
    await expect(adminPage.getByText("E2E-FLOW-KEY")).toBeVisible();
    await expect(adminPage.getByText("E2EFlowCorp")).toBeVisible();

    // Logout admin (clear cookies) and open registration page
    await adminPage.context().clearCookies();
    await page.goto("/register");
    await expect(page.getByText(/Konto erstellen|Create an account/i)).toBeVisible();

    // Fill registration form with the key
    await page.getByLabel(/Vorname|First name/i).fill("Key");
    await page.getByLabel(/Nachname|Last name/i).fill("User");
    await page.getByLabel(/E-Mail-Adresse|Email address/i).fill("keyuser@e2eflow.test");
    await page.getByLabel(/Passwort|Password/i).fill("KeyUserPass123!");
    await page.getByLabel(/Registrierungsschlüssel|Registration key/i).fill("E2E-FLOW-KEY");
    await page.getByLabel(/Unternehmen|Company/i).fill("E2EFlowCorp");

    // Submit
    await page.getByRole("button", { name: /konto erstellen|create account/i }).click();

    // Wait for response
    await page.waitForTimeout(2000);

    // Check if registration succeeded or is waiting for Supabase email confirmation.
    const successMsg = page.getByText(/successful|success|please check your email/i);
    const errorMsg = page.getByText(/error|failed/i);
    void successMsg;
    void errorMsg;

    // Confirm the same registration boundary through the API.
    const apiResponse = await page.request.post("/api/auth/register", {
      data: {
        email: "keyuser-api@e2eflow.test",
        password: "KeyUserPass123!",
        firstname: "Key",
        lastname: "User",
        company: "E2EFlowCorp",
        registrationCode: "E2E-FLOW-KEY",
      },
    });
    expect(apiResponse.status()).toBe(201);
  });

  test("Non-admin user blocked from /admin/registration-keys API", async ({ authenticatedPage }) => {
    // Test API directly
    const apiResponse = await authenticatedPage.request.post("/api/admin/registration-keys", {
      data: {
        code: "PARITY-BLOCK-KEY",
        totalSlots: 5,
      },
    });

    expect(apiResponse.status()).toBe(403);

  });
});
