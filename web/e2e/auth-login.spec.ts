import { test, expect } from "@playwright/test";
import { hasUserE2EConfig } from "./config";

test.describe("Login — username OR email", () => {
  test.skip(!hasUserE2EConfig, "Configure a dedicated Supabase test project for login E2E tests.");
  test("Login with email succeeds", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /anmelden|sign in/i })).toBeVisible();

    // Fill with email
    await page.getByLabel(/e-mail oder benutzername|email or username/i).fill("e2e-testuser@example.com");
    await page.getByLabel(/passwort|password/i).fill("E2eTestPassword123!");

    // Submit
    await page.getByRole("button", { name: /anmelden|sign in/i }).click();

    // Wait for redirect to dashboard or home
    await page.waitForURL(/\/dashboard|\/$/);

    // Verify logged in by checking welcome message
    await expect(page.getByRole("button", { name: /prüfung starten|start check/i })).toBeVisible();
  });

  test("Login with username succeeds", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /anmelden|sign in/i })).toBeVisible();

    // Fill with username instead of email
    await page.getByLabel(/e-mail oder benutzername|email or username/i).fill("e2etestuser");
    await page.getByLabel(/passwort|password/i).fill("E2eTestPassword123!");

    // Submit
    await page.getByRole("button", { name: /anmelden|sign in/i }).click();

    // Wait for redirect to dashboard or home
    await page.waitForURL(/\/dashboard|\/$/);

    // Verify logged in
    await expect(page.getByRole("button", { name: /prüfung starten|start check/i })).toBeVisible();
  });

  test("Invalid credentials rejected", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /anmelden|sign in/i })).toBeVisible();

    // Fill with wrong password
    await page.getByLabel(/e-mail oder benutzername|email or username/i).fill("e2e-testuser@example.com");
    await page.getByLabel(/passwort|password/i).fill("WrongPassword!");

    // Submit
    await page.getByRole("button", { name: /anmelden|sign in/i }).click();

    // Verify error message appears
    await expect(page.getByRole("alert")).toBeVisible();
  });

  test("Login with non-existent username rejected", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: /anmelden|sign in/i })).toBeVisible();

    // Fill with non-existent username
    await page.getByLabel(/e-mail oder benutzername|email or username/i).fill("nonexistentuser");
    await page.getByLabel(/passwort|password/i).fill("SomePassword123!");

    // Submit
    await page.getByRole("button", { name: /anmelden|sign in/i }).click();

    // Verify error message appears
    await expect(page.getByRole("alert")).toBeVisible();
  });
});
