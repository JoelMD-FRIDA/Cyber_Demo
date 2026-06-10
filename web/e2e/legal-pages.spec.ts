import { test, expect } from "@playwright/test";

test.describe("German legal pages", () => {
  test("/impressum returns 200 and displays German heading", async ({
    page,
  }) => {
    const response = await page.goto("/impressum");
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: "Impressum" }),
    ).toBeVisible();
    await expect(
      page.getByText("Gemeinschaftlich vertretungsberechtigt"),
    ).toBeVisible();
    await expect(page.getByText("FRIDA e. V.")).toBeVisible();
  });

  test("/datenschutz returns 200 and displays heading", async ({
    page,
  }) => {
    const response = await page.goto("/datenschutz");
    expect(response?.ok()).toBe(true);
    await expect(
      page.getByRole("heading", { level: 1, name: "Datenschutz" }),
    ).toBeVisible();
    await expect(
      page.getByText("Datenschutzhinweis für die Nutzung der Sandbox"),
    ).toBeVisible();
  });

  test("layout html lang is de", async ({ page }) => {
    await page.goto("/");
    const htmlLang = await page.evaluate(() =>
      document.documentElement.getAttribute("lang"),
    );
    expect(htmlLang).toBe("de");
  });

  test("footer contains legal links and frida logo", async ({ page }) => {
    await page.goto("/");
    const impressumLink = page.getByRole("link", { name: /impressum/i });
    const datenschutzLink = page.getByRole("link", {
      name: /datenschutz/i,
    });
    await expect(impressumLink).toBeVisible();
    await expect(datenschutzLink).toBeVisible();
    await expect(impressumLink).toHaveAttribute("href", "/impressum");
    await expect(datenschutzLink).toHaveAttribute("href", "/datenschutz");

    await expect(page.getByAltText("FRIDA Logo")).toBeVisible();
  });
});
