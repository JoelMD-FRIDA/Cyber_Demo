import { test as setup, expect } from "@playwright/test";
import { ADMIN_STORAGE_PATH } from "./fixtures";

const ADMIN_USER = { email: process.env.E2E_ADMIN_EMAIL ?? "", password: process.env.E2E_ADMIN_PASSWORD ?? "" };

setup("authenticate as admin", async ({ page }) => {
  setup.skip(!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || !ADMIN_USER.email || !ADMIN_USER.password, "Configure a dedicated Supabase test project for admin E2E tests.");
  await page.goto("/login");

  // Wait for the form to be visible
  await expect(page.getByLabel(/e-?mail/i)).toBeVisible();

  // Fill in credentials
  await page.getByLabel(/e-?mail/i).fill(ADMIN_USER.email);
  await page.getByLabel(/passwort|password/i).fill(ADMIN_USER.password);

  // Submit login form
  await page.getByRole("button", { name: /anmelden|sign in/i }).click();

  // Wait for redirect — admin may go to dashboard or admin panel
  await page.waitForURL(/\/dashboard|\/$|\/admin/);

  // Save storage state for reuse
  await page.context().storageState({ path: ADMIN_STORAGE_PATH });
});
