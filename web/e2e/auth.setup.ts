import { test as setup, expect } from "@playwright/test";
import { AUTH_STORAGE_PATH } from "./fixtures";

const AUTH_USER = { email: process.env.E2E_USER_EMAIL ?? "", password: process.env.E2E_USER_PASSWORD ?? "" };

setup("authenticate as regular user", async ({ page }) => {
  setup.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !AUTH_USER.email || !AUTH_USER.password, "Configure a dedicated Supabase test project for authenticated E2E tests.");
  await page.goto("/login");

  // Wait for the form to be visible
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/e-?mail/i).fill(AUTH_USER.email);
  await page.getByLabel(/passwort|password/i).fill(AUTH_USER.password);

  // Submit login form
  await page.getByRole("button", { name: /anmelden|sign in/i }).click();

  // Wait for redirect to dashboard or home
  await page.waitForURL(/\/dashboard|\/$/);

  // Save storage state for reuse
  await page.context().storageState({ path: AUTH_STORAGE_PATH });
});
