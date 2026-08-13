import { test, expect } from "./fixtures";
import { hasAdminE2EConfig, hasSupabaseE2EConfig, hasUserE2EConfig } from "./config";

test.describe("Home page — anonymous visitor", () => {
  test.skip(!hasSupabaseE2EConfig, "Configure a dedicated Supabase test project for browser E2E tests.");
  test("home page loads and shows frida logo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText("FRIDA").first()).toBeVisible();
    await expect(
      page.getByText("Domain-Sicherheit auf einem neuen Level"),
    ).toBeVisible();
  });

  test("home page shows register and login CTAs", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /kostenlos registrieren/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /anmelden/i }),
    ).toBeVisible();
  });

  test("home page shows feature cards", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("Funktionen")).toBeVisible();
    await expect(page.getByText("Sicherheitsprüfung")).toBeVisible();
    await expect(page.getByText("Berichte und Analysen")).toBeVisible();
    await expect(page.getByText("Anbieter")).toBeVisible();
  });

  test("home page shows how-it-works section", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText("So funktioniert es")).toBeVisible();
    await expect(page.getByText("Registrieren")).toBeVisible();
    await expect(page.getByText("Domain prüfen")).toBeVisible();
    await expect(page.getByText("Ergebnisse erhalten")).toBeVisible();
  });

  test("home page has legal footer links", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /impressum/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /datenschutz/i }),
    ).toBeVisible();
    await expect(page.getByText(/FRIDA e\.V\./)).toBeVisible();
  });

  test("anonymous navigation shows login and register", async ({ page }) => {
    await page.goto("/");
    await expect(
      page.getByRole("link", { name: /anmelden|sign in/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /registrieren|register/i }).first(),
    ).toBeVisible();
  });
});

test.describe("Home page — authenticated user", () => {
  test.skip(!hasUserE2EConfig, "Configure a dedicated Supabase test project for authenticated E2E tests.");
  test("shows welcome message and domain-check link", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await expect(authenticatedPage.getByRole("button", { name: /prüfung starten|start check/i })).toBeVisible();
    await expect(
      authenticatedPage.getByRole("link", { name: /domain-check/i }),
    ).toBeVisible();
  });

  test("user cannot see admin navigation", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/");
    await expect(
      authenticatedPage.getByText("Administration"),
    ).not.toBeVisible();
  });
});

test.describe("Home page — admin", () => {
  test.skip(!hasAdminE2EConfig, "Configure a dedicated Supabase test project for admin E2E tests.");
  test("shows operational admin navigation", async ({ adminPage }) => {
    await adminPage.goto("/");
    await expect(
      adminPage.getByText("Administration"),
    ).toBeVisible();
  });

  test("admin does not see removed legacy navigation", async ({ adminPage }) => {
    await adminPage.goto("/");
    await expect(adminPage.getByRole("link", { name: /dashboard/i })).toBeVisible();
    await expect(adminPage.getByText(/API Credentials|E-Mail-Konten|PGP|Master Data|Scheduled Jobs/i)).not.toBeVisible();
  });
});
