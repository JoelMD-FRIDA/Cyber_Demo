import { test as setup, expect } from "@playwright/test";
import { AUTH_STORAGE_PATH } from "./fixtures";

const AUTH_USER = {
  email: "e2e-testuser@example.com",
  password: "E2eTestPassword123!",
};

setup("authenticate as regular user", async ({ page }) => {
  await page.goto("/login");

  // Wait for the form to be visible
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/e-?mail/i).fill(AUTH_USER.email);
  await page.getByLabel(/passwort|password/i).fill(AUTH_USER.password);

  // Submit login form
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  // Wait for redirect to dashboard or home
  await page.waitForURL(/\/dashboard|\/$/);

  // Save storage state for reuse
  await page.context().storageState({ path: AUTH_STORAGE_PATH });
});
