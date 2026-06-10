import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin provider management", () => {
  test("Admin views provider list and creates a provider with full fields", async ({ adminPage }) => {
    await adminPage.goto("/admin/providers");

    // Verify the page title
    await expect(adminPage.getByText("Providers")).toBeVisible();
    await expect(adminPage.getByText("Manage domain check providers.")).toBeVisible();

    // Click Add Provider button
    await adminPage.getByRole("button", { name: "Add Provider" }).click();

    // Fill in the create provider dialog
    await adminPage.getByLabel("Name").fill("ParityTestProvider");
    await adminPage.getByLabel("API Base URL").fill("https://api.paritytest.example.com/v2");
    await adminPage.getByLabel("Short Description").fill("A short description for parity");
    await adminPage.getByLabel("Long Description").fill("A long description that goes into detail about this parity test provider.");
    await adminPage.getByRole("button", { name: "Create" }).click();

    // Wait for dialog to close and list to refresh
    await adminPage.waitForTimeout(1000);

    // Verify the new provider appears
    await expect(adminPage.getByText("ParityTestProvider")).toBeVisible();
    await expect(adminPage.getByText("A short description for parity")).toBeVisible();

    // Take screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-create-provider.png`,
      fullPage: true,
    });
  });

  test("Admin edits an existing provider", async ({ adminPage }) => {
    // First create a provider to edit
    await adminPage.goto("/admin/providers");
    await adminPage.getByRole("button", { name: "Add Provider" }).click();
    await adminPage.getByLabel("Name").fill("EditableProvider");
    await adminPage.getByLabel("API Base URL").fill("https://api.editable.example.com");
    await adminPage.getByRole("button", { name: "Create" }).click();
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
    await adminPage.getByRole("button", { name: "Edit" }).click();
    await adminPage.waitForTimeout(1000);

    // Verify the updated name appears
    await expect(adminPage.getByText("EditedProvider")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-edit-provider.png`,
      fullPage: true,
    });
  });

  test("Non-admin user is blocked from /admin/providers", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.goto("/admin/providers");

    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly
    const apiResponse = await authenticatedPage.request.post("/api/providers", {
      data: {
        name: "BlockedProvider",
        isActive: true,
      },
    });
    expect(apiResponse.status()).toBe(403);
  });
});
