import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  timeout: 30_000,

  // Global setup runs ONCE before all projects
  globalSetup: "./e2e/global-setup.ts",

  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },

  projects: [
    // ── Setup projects ──────────────────────────────────────────────────────
    // These authenticate as regular user and admin, saving storage state.
    {
      name: "auth-setup",
      testMatch: "auth.setup.ts",
    },
    {
      name: "admin-setup",
      testMatch: "admin.setup.ts",
    },

    // ── Authenticated (regular user) ─────────────────────────────────────────
    {
      name: "authenticated",
      dependencies: ["auth-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/user.json",
      },
    },

    // ── Admin ───────────────────────────────────────────────────────────────
    {
      name: "admin",
      dependencies: ["admin-setup"],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "e2e/.auth/admin.json",
      },
    },

    // ── Anonymous (no auth) ─────────────────────────────────────────────────
    {
      name: "anonymous",
      use: {
        ...devices["Desktop Chrome"],
        // No storageState — acts as unauthenticated visitor
      },
    },

    // ── Chromium (existing smoke tests) ──────────────────────────────────────
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  webServer: {
    command: "npm run start",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
