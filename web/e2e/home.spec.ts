import { test, expect } from "./fixtures";

test.describe("Home page — anonymous visitor", () => {
  test("home page loads and shows frida logo", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByAltText("FRIDA Logo")).toBeVisible();
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
    await expect(page.getByText("Domain-Recherche")).toBeVisible();
    await expect(page.getByText("Sicherheitsprüfung")).toBeVisible();
    await expect(page.getByText("Berichte & Analysen")).toBeVisible();
    await expect(page.getByText("Multi-Provider")).toBeVisible();
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
      page.getByRole("link", { name: /log in|login/i }).first(),
    ).toBeVisible();
    await expect(
      page.getByRole("link", { name: /register/i }).first(),
    ).toBeVisible();
  });
});

test.describe("Home page — authenticated user", () => {
  test("shows welcome message and domain-check link", async ({
    authenticatedPage,
  }) => {
    await authenticatedPage.goto("/");
    await expect(authenticatedPage.getByText("Willkommen")).toBeVisible();
    await expect(
      authenticatedPage.getByText("Domain-Check"),
    ).toBeVisible();
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
  test("shows welcome message and admin link", async ({ adminPage }) => {
    await adminPage.goto("/");
    await expect(adminPage.getByText("Willkommen")).toBeVisible();
    await expect(
      adminPage.getByText("Administration"),
    ).toBeVisible();
  });

  test("admin sees system quick-info", async ({ adminPage }) => {
    await adminPage.goto("/");
    await expect(adminPage.getByText("Quick-Info")).toBeVisible();
    await expect(adminPage.getByText("Über FRIDA Domain Check")).toBeVisible();
  });
});
