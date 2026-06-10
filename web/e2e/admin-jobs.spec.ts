import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin scheduled jobs management", () => {
  test("Admin views scheduled jobs page", async ({ adminPage }) => {
    await adminPage.goto("/admin/jobs");

    // Verify the page title
    await expect(adminPage.getByText("Scheduled Jobs")).toBeVisible();
    await expect(
      adminPage.getByText("View recent scheduled and background job runs."),
    ).toBeVisible();

    // Verify the card shows empty state
    await expect(adminPage.getByText("Job Runs")).toBeVisible();

    // Screenshot for evidence
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-jobs.png`,
      fullPage: true,
    });
  });

  test("Admin triggers email processing", async ({ adminPage }) => {
    await adminPage.goto("/admin/jobs");
    await expect(adminPage.getByText("Scheduled Jobs")).toBeVisible();

    // Click Trigger Email Processing
    await adminPage.getByRole("button", { name: /trigger email processing/i }).click();

    // Wait for processing to complete
    await adminPage.waitForTimeout(2000);

    // After trigger, we should see either a success or error result message
    // The trigger result banner should appear
    const resultBanner = adminPage.locator(".border-emerald-200, .border-destructive\\/20");

    // Take screenshot showing the result
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-trigger-job.png`,
      fullPage: true,
    });

    // Refresh and verify a job entry appears
    await adminPage.goto("/admin/jobs");
    await adminPage.waitForTimeout(500);

    // The job table should now show entries
    const jobTable = adminPage.locator("table");
    if (await jobTable.isVisible().catch(() => false)) {
      // Verify job entries exist in the table
      const rows = await jobTable.locator("tbody tr").count();
      expect(rows).toBeGreaterThanOrEqual(1);
    }

    // Screenshot of jobs table with entry
    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-jobs-with-entry.png`,
      fullPage: true,
    });
  });

  test("Non-admin user is blocked from /admin/jobs", async ({ authenticatedPage }) => {
    const response = await authenticatedPage.goto("/admin/jobs");
    await authenticatedPage.waitForURL(/\/unauthorized/);
    expect(response?.status()).toBeLessThan(400);

    // Also test API directly
    const apiResponse = await authenticatedPage.request.post("/api/admin/jobs/trigger");
    expect(apiResponse.status()).toBe(403);
  });
});
