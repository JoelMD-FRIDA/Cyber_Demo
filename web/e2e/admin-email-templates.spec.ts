import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin email template management", () => {
  test("Admin views email templates list", async ({ adminPage }) => {
    await adminPage.goto("/admin/email-templates");

    // Verify the page title
    await expect(adminPage.getByText("Email Templates")).toBeVisible();
    await expect(
      adminPage.getByText("Manage email templates used for registration, password reset"),
    ).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-email-templates.png`,
      fullPage: true,
    });
  });

  test("Admin creates an email template", async ({ adminPage }) => {
    await adminPage.goto("/admin/email-templates");
    await expect(adminPage.getByText("Email Templates")).toBeVisible();

    // Click Add Template
    await adminPage.getByRole("button", { name: "Add Template" }).click();

    // Fill in the template form
    await adminPage.getByPlaceholder("e.g. registration, forgot-password").fill("test-parity-template");
    await adminPage.getByPlaceholder("Subject line with {{variables}}").fill("Parity Test {{username}}");
    await adminPage.getByPlaceholder("<html>Handlebars {{variables}} here</html>").fill("<h1>Hello {{username}}!</h1><p>Welcome to FRIDA.</p>");

    // Submit
    await adminPage.getByRole("button", { name: "Create" }).click();
    await adminPage.waitForTimeout(1000);

    // Verify the template appears in the list
    await expect(adminPage.getByText("test-parity-template")).toBeVisible();
    await expect(adminPage.getByText("Parity Test {{username}}")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-create-email-template.png`,
      fullPage: true,
    });
  });

  test("Admin edits a template subject and body", async ({ adminPage }) => {
    // First create a template to edit
    await adminPage.goto("/admin/email-templates");
    await adminPage.getByRole("button", { name: "Add Template" }).click();
    await adminPage.getByPlaceholder("e.g. registration, forgot-password").fill("editable-template");
    await adminPage.getByPlaceholder("Subject line with {{variables}}").fill("Original Subject");
    await adminPage.getByPlaceholder("<html>Handlebars {{variables}} here</html>").fill("<p>Original body</p>");
    await adminPage.getByRole("button", { name: "Create" }).click();
    await adminPage.waitForTimeout(800);

    // Find the template and click Edit
    await adminPage.goto("/admin/email-templates");
    await adminPage.waitForTimeout(500);

    const editBtn = adminPage.getByRole("button", { name: /edit editable-template/i });
    await editBtn.click();

    // Edit the subject
    const subjectInput = adminPage.getByPlaceholder("Subject line with {{variables}}");
    await subjectInput.clear();
    await subjectInput.fill("Updated Subject {{username}}");

    // Save
    await adminPage.getByRole("button", { name: "Save" }).click();
    await adminPage.waitForTimeout(1000);

    // Verify updated template appears
    await expect(adminPage.getByText("Updated Subject {{username}}")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-edit-email-template.png`,
      fullPage: true,
    });
  });

  test("Non-admin user is blocked from /admin/email-templates", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.goto("/admin/email-templates");
    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly
    const apiResponse = await authenticatedPage.request.post("/api/admin/email-templates", {
      data: {
        name: "blocked-template",
        subject: "Blocked",
        body: "<p>Blocked</p>",
      },
    });
    expect(apiResponse.status()).toBe(403);
  });
});
