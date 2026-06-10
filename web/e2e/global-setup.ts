import { FullConfig } from "@playwright/test";
import { execSync } from "child_process";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

// ── Configuration ─────────────────────────────────────────────────────────────

const DATABASE_URL =
  process.env.TEST_DATABASE_URL ||
  process.env.DATABASE_URL ||
  "postgresql://user:pass@localhost:5432/frida_domaincheck";

const SEED_USERS = [
  {
    email: "e2e-testuser@example.com",
    username: "e2etestuser",
    firstname: "E2E",
    lastname: "TestUser",
    role: "user",
    password: "E2eTestPassword123!",
    isActivated: true,
    company: "E2ETest",
  },
  {
    email: "e2e-admin@example.com",
    username: "e2eadmin",
    firstname: "E2E",
    lastname: "Admin",
    role: "admin",
    password: "E2eAdminPass456!",
    isActivated: true,
    company: "E2ETest",
  },
];

// ── Global Setup ──────────────────────────────────────────────────────────────

async function globalSetup(_config: FullConfig): Promise<void> {
  console.log("[global-setup] Starting Playwright global setup...");

  // 1. Ensure database is migrated
  try {
    console.log("[global-setup] Running database migrations...");
    execSync("npx drizzle-kit migrate", {
      cwd: process.cwd(),
      env: { ...process.env, DATABASE_URL },
      stdio: "pipe",
      timeout: 30_000,
    });
    console.log("[global-setup] Migrations complete.");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`[global-setup] Migration warning (non-fatal): ${message}`);
    // Non-fatal — DB might already be migrated
  }

  // 2. Seed test users
  const pool = new Pool({ connectionString: DATABASE_URL });
  try {
    for (const user of SEED_USERS) {
      const existing = await pool.query(
        "SELECT id FROM users WHERE email = $1",
        [user.email],
      );

      if (existing.rows.length === 0) {
        const passwordHash = await bcrypt.hash(user.password, 10);
        await pool.query(
          `INSERT INTO users (email, username, firstname, lastname, role, password_hash, is_activated, company)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            user.email,
            user.username || null,
            user.firstname,
            user.lastname,
            user.role,
            passwordHash,
            user.isActivated,
            user.company,
          ],
        );
        console.log(
          `[global-setup] Seeded user: ${user.email} (${user.role})`,
        );
      } else {
        console.log(
          `[global-setup] User already exists: ${user.email}`,
        );
      }
    }
  } catch (err) {
    console.error("[global-setup] Seed error:", err);
    throw err;
  } finally {
    await pool.end();
  }

  console.log("[global-setup] Complete.");
}

export default globalSetup;
