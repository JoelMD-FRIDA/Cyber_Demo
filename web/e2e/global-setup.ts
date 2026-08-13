/**
 * E2E runs use a dedicated Supabase project. The project is deliberately not
 * mutated or seeded here: create disposable users through the protected
 * Supabase test-project setup before running Playwright.
 */
export default async function globalSetup(): Promise<void> {
  const required = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "E2E_USER_EMAIL",
    "E2E_USER_PASSWORD",
    "E2E_ADMIN_EMAIL",
    "E2E_ADMIN_PASSWORD",
  ];
  const missing = required.filter((name) => !process.env[name]);
  if (missing.length > 0) {
    console.warn(`[global-setup] Skipping credential setup; missing ${missing.join(", ")}. Configure a dedicated Supabase test project before running E2E.`);
  }
}
