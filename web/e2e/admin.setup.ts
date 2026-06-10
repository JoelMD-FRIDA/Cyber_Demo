import { test as setup, expect } from "@playwright/test";
import { ADMIN_STORAGE_PATH } from "./fixtures";

const ADMIN_USER = {
  email: "e2e-admin@example.com",
  password: "E2eAdminPass456!",
};

setup("authenticate as admin", async ({ page }) => {
  await page.goto("/login");

  // Wait for the form to be visible
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/e-?mail/i).fill(ADMIN_USER.email);
  await page.getByLabel(/passwort|password/i).fill(ADMIN_USER.password);

  // Submit login form
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Wait for redirect — admin may go to dashboard or admin panel
  await page.waitForURL(/\/dashboard|\/$|\/admin/);

  // Save storage state for reuse
  await page.context().storageState({ path: ADMIN_STORAGE_PATH });
});
