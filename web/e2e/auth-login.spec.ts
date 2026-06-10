import { test, expect } from "@playwright/test";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Login — username OR email", () => {
  test("Login with email succeeds", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Fill with email
    await page.getByLabel("Email or Username").fill("e2e-testuser@example.com");
    await page.getByLabel("Password").fill("E2eTestPassword123!");

    // Submit
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for redirect to dashboard or home
    await page.waitForURL(/\/dashboard|\/$/);

    // Verify logged in by checking welcome message
    await expect(page.getByText("Willkommen")).toBeVisible();

    // Evidence screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/task-17-login-email.png`,
      fullPage: true,
    });
  });

  test("Login with username succeeds", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Fill with username instead of email
    await page.getByLabel("Email or Username").fill("e2etestuser");
    await page.getByLabel("Password").fill("E2eTestPassword123!");

    // Submit
    await page.getByRole("button", { name: "Sign in" }).click();

    // Wait for redirect to dashboard or home
    await page.waitForURL(/\/dashboard|\/$/);

    // Verify logged in
    await expect(page.getByText("Willkommen")).toBeVisible();

    // Evidence screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/task-17-login-username.png`,
      fullPage: true,
    });
  });

  test("Invalid credentials rejected", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Fill with wrong password
    await page.getByLabel("Email or Username").fill("e2e-testuser@example.com");
    await page.getByLabel("Password").fill("WrongPassword!");

    // Submit
    await page.getByRole("button", { name: "Sign in" }).click();

    // Verify error message appears
    await expect(page.getByText(/login failed|ungültig|invalid|falsch/i)).toBeVisible();

    // Evidence screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/task-17-login-invalid.png`,
      fullPage: true,
    });
  });

  test("Login with non-existent username rejected", async ({ page }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

    // Fill with non-existent username
    await page.getByLabel("Email or Username").fill("nonexistentuser");
    await page.getByLabel("Password").fill("SomePassword123!");

    // Submit
    await page.getByRole("button", { name: "Sign in" }).click();

    // Verify error message appears
    await expect(page.getByText(/login failed|ungültig|invalid|falsch|nicht gefunden/i)).toBeVisible();

    // Evidence screenshot
    await page.screenshot({
      path: `${EVIDENCE_DIR}/task-17-login-nonexistent.png`,
      fullPage: true,
    });
  });
});
