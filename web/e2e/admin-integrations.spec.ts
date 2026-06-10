import fs from "fs";
import path from "path";
import { test, expect } from "./fixtures";

const EVIDENCE_DIR = "../.sisyphus/evidence";

test.describe("Admin configuration status", () => {
  test("Admin views SMTP status on email accounts page", async ({ adminPage }) => {
    await adminPage.goto("/admin/email-accounts");

    await expect(adminPage.getByRole("heading", { name: "Email Accounts" })).toBeVisible();
    await expect(adminPage.getByText("SMTP Email", { exact: true })).toBeVisible();
    await expect(adminPage.getByText("SMTP_HOST").first()).toBeVisible();

    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-smtp-status.png`,
      fullPage: true,
    });
  });

  test("Admin views PGP status on PGP certificates page", async ({ adminPage }) => {
    await adminPage.goto("/admin/pgp");

    await expect(adminPage.getByRole("heading", { name: "PGP Certificates" })).toBeVisible();
    await expect(adminPage.getByText("PGP Encryption", { exact: true })).toBeVisible();
    await expect(adminPage.getByText("PGP_PUBLIC_KEY").first()).toBeVisible();

    await adminPage.screenshot({
      path: `${EVIDENCE_DIR}/task-17-admin-pgp-status.png`,
      fullPage: true,
    });
  });

  test("Status API remains admin-only", async ({ adminPage, authenticatedPage }) => {
    const apiResponse = await adminPage.request.get("/api/admin/integrations/status");
    expect(apiResponse.ok()).toBe(true);
    const responseBody = await apiResponse.json();

    const evidencePath = path.resolve(process.cwd(), `${EVIDENCE_DIR}/task-17-integrations-status.json`);
    fs.mkdirSync(path.dirname(evidencePath), { recursive: true });
    fs.writeFileSync(
      evidencePath,
      JSON.stringify(responseBody, null, 2),
    );

    const nonAdminResponse = await authenticatedPage.request.get("/api/admin/integrations/status");
    expect(nonAdminResponse.status()).toBe(403);
  });
});
