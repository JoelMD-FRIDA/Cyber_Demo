import { test, expect } from "./fixtures";
import { hasAdminE2EConfig } from "./config";

test.describe("Admin provider management", () => {
  test.skip(!hasAdminE2EConfig, "Configure a dedicated Supabase test project for admin E2E tests.");
  test("Admin views provider list and creates a provider with full fields", async ({ adminPage }) => {
    await adminPage.goto("/admin/providers");

    // Verify the page title
    await expect(adminPage.getByText(/Anbieter|Providers/).first()).toBeVisible();

    // Click Add Provider button
    await adminPage.getByRole("button", { name: /anbieter hinzufügen|add provider/i }).click();

    // Fill in the create provider dialog
    await adminPage.getByLabel(/Provider-Schlüssel|Provider key/i).fill("parity-test");
    await adminPage.getByLabel("Name").fill("ParityTestProvider");
    await adminPage.getByLabel(/Kurzbeschreibung|Short description/i).fill("A short description for parity");
    await adminPage.getByLabel(/Langbeschreibung|Long description/i).fill("A long description that goes into detail about this parity test provider.");
    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();

    // Wait for dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new provider appears
    await expect(adminPage.getByText("ParityTestProvider")).toBeVisible();
    await expect(adminPage.getByText("A short description for parity")).toBeVisible();

  });

  test("Admin edits an existing provider", async ({ adminPage }) => {
    // First create a provider to edit
    await adminPage.goto("/admin/providers");
    await adminPage.getByRole("button", { name: /anbieter hinzufügen|add provider/i }).click();
    await adminPage.getByLabel("Name").fill("EditableProvider");
    await adminPage.getByLabel(/Provider-Schlüssel|Provider key/i).fill("editable-provider");
    await adminPage.getByRole("button", { name: /hinzufügen|add/i }).last().click();
    await adminPage.waitForTimeout(800);

    // Find the edit button for EditableProvider
    await adminPage.goto("/admin/providers");
    await adminPage.waitForTimeout(500);

    // Click the edit button (the pencil icon) for EditableProvider
    const editBtn = adminPage.getByRole("button", { name: /edit editableprovider/i });
    await editBtn.click();

    // Edit the name
    await adminPage.getByLabel("Name").clear();
    await adminPage.getByLabel("Name").fill("EditedProvider");
    await adminPage.getByRole("button", { name: /speichern|save/i }).click();
    await adminPage.waitForTimeout(1000);

    // Verify the updated name appears
    await expect(adminPage.getByText("EditedProvider")).toBeVisible();

  });

  test("Non-admin user is blocked from /admin/providers", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.goto("/admin/providers");

    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly
    const apiResponse = await authenticatedPage.request.post("/api/admin/providers", {
      data: {
        name: "BlockedProvider",
        isActive: true,
      },
    });
    expect(apiResponse.status()).toBe(403);
  });
});
