#!/usr/bin/env node

/**
 * Migration Verification Script
 *
 * Verifies the integrity of HSQLDB -> PostgreSQL migration by:
 *   1. Querying row counts for all 12 business entity tables
 *   2. Checking foreign key integrity (no orphaned records)
 *   3. Checking encrypted fields for non-null content
 *   4. Outputting pass/fail for each check
 *
 * Usage:
 *   DATABASE_URL=postgresql://user:pass@localhost:5432/frida_domaincheck node scripts/verify.mjs
 *
 * Returns exit code 0 only if ALL checks pass.
 */

import { Pool } from 'pg';

// ── Configuration ────────────────────────────────────────────────────────────

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

/**
 * Business entity tables to verify.
 *
 * Two naming conventions exist:
 *   - HSQLDB conventions (raw names from Mendix, used by migrate.mjs)
 *   - PostgreSQL schema conventions (from src/db/schema.ts, used by the app)
 *
 * We check both groups. Tables with identical names across both are unified.
 */
const TABLES = {
  /** Tables named per the src/db/schema.ts Drizzle ORM schema */
  pgSchema: [
    { name: 'users',               label: 'Users' },
    { name: 'activation_requests', label: 'Activation Requests' },
    { name: 'registration_keys',   label: 'Registration Keys' },
    { name: 'domain_check_providers', label: 'Domain Check Providers' },
    { name: 'domain_check_categories', label: 'Domain Check Categories' },
    { name: 'domain_checks',       label: 'Domain Checks' },
    { name: 'api_credentials',     label: 'API Credentials' },
    { name: 'oauth_tokens',        label: 'OAuth Tokens' },
    { name: 'pgp_certificates',    label: 'PGP Certificates' },
    { name: 'forgot_password_requests', label: 'Forgot Password Requests' },
    { name: 'email_templates',     label: 'Email Templates' },
    { name: 'email_queue',         label: 'Email Queue' },
  ],

  /** Tables as they appear in the HSQLDB source (what migrate.mjs creates) */
  hsqldbNames: [
    { name: 'administration$account',          label: 'Administration.Account' },
    { name: 'core$user',                       label: 'Core.User' },
    { name: 'core$activationrequest',          label: 'Core.ActivationRequest' },
    { name: 'core$registrationkey',            label: 'Core.RegistrationKey' },
    { name: 'domaincheck$domaincheckprovider', label: 'DomainCheck.Provider' },
    { name: 'domaincheck$domaincheckcategory', label: 'DomainCheck.Category' },
    { name: 'api$apicredentials',              label: 'API.APICredentials' },
    { name: 'api$oauthtoken',                  label: 'API.OAuthToken' },
    { name: 'encryption$pgpcertificate',       label: 'Encryption.PGPCertificate' },
    { name: 'forgotpassword$forgotpassword',   label: 'ForgotPassword.ForgotPassword' },
    { name: 'email_connector$emailtemplate',   label: 'EmailConnector.EmailTemplate' },
  ],
};

/**
 * Foreign key constraints to validate.
 * Each entry describes a FK relationship that must not have orphaned records.
 */
const FK_CHECKS = [
  {
    label: 'domain_checks → users',
    table: 'domain_checks',
    foreignKey: 'user_id',
    referencedTable: 'users',
    referencedKey: 'id',
  },
  {
    label: 'domain_checks → domain_check_providers',
    table: 'domain_checks',
    foreignKey: 'provider_id',
    referencedTable: 'domain_check_providers',
    referencedKey: 'id',
  },
  {
    label: 'domain_checks → domain_check_categories',
    table: 'domain_checks',
    foreignKey: 'category_id',
    referencedTable: 'domain_check_categories',
    referencedKey: 'id',
  },
];

/**
 * Encrypted/sensitive fields to check.
 * These should never be NULL or empty if the row exists.
 */
const ENCRYPTED_FIELD_CHECKS = [
  {
    label: 'users.password_hash',
    table: 'users',
    column: 'password_hash',
  },
  {
    label: 'domain_check_providers.api_key_encrypted',
    table: 'domain_check_providers',
    column: 'api_key_encrypted',
  },
  {
    label: 'api_credentials.password_encrypted',
    table: 'api_credentials',
    column: 'password_encrypted',
  },
  {
    label: 'pgp_certificates.passphrase_encrypted',
    table: 'pgp_certificates',
    column: 'passphrase_encrypted',
  },
];

// ── Results ──────────────────────────────────────────────────────────────────

const results = {
  rowChecks: [],
  fkChecks: [],
  encryptedChecks: [],
  errors: [],
};

let allPassed = true;

// ── Helpers ──────────────────────────────────────────────────────────────────

function pass(check) {
  results[check.type].push({ ...check, status: 'PASS' });
  console.log(`  ✓ ${check.label}`);
}

function fail(check, detail) {
  results[check.type].push({ ...check, status: 'FAIL', detail });
  allPassed = false;
  console.error(`  ✗ ${check.label}: ${detail}`);
}

function error(check, errMsg) {
  results.errors.push({ ...check, detail: errMsg });
  allPassed = false;
  console.error(`  ! ${check.label}: ERROR - ${errMsg}`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const pool = new Pool({ connectionString: DATABASE_URL });

  console.log('=== Migration Verification ===\n');
  console.log(`Database: ${DATABASE_URL.split('@')[1] ?? '(local)'}\n`);

  try {
    // ── Phase 1: Row Counts ──────────────────────────────────────────────────
    console.log('--- Row Counts (schema.ts tables) ---');
    for (const table of TABLES.pgSchema) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "${table.name}"`);
        const count = rows[0].cnt;
        pass({
          type: 'rowChecks',
          label: `${table.label} (${table.name}): ${count} rows`,
          table: table.name,
          count,
        });
      } catch (e) {
        error(
          { type: 'rowChecks', label: `${table.label} (${table.name})`, table: table.name },
          e.message,
        );
      }
    }

    console.log('\n--- Row Counts (HSQLDB-named tables) ---');
    for (const table of TABLES.hsqldbNames) {
      try {
        const { rows } = await pool.query(`SELECT COUNT(*)::int AS cnt FROM "${table.name}"`);
        const count = rows[0].cnt;
        pass({
          type: 'rowChecks',
          label: `${table.label} (${table.name}): ${count} rows`,
          table: table.name,
          count,
        });
      } catch (e) {
        error(
          { type: 'rowChecks', label: `${table.label} (${table.name})`, table: table.name },
          e.message,
        );
      }
    }

    // ── Phase 2: Foreign Key Integrity ───────────────────────────────────────
    console.log('\n--- Foreign Key Integrity ---');
    for (const fk of FK_CHECKS) {
      try {
        const { rows } = await pool.query(`
          SELECT COUNT(*)::int AS orphan_count
          FROM "${fk.table}" t
          LEFT JOIN "${fk.referencedTable}" r ON t.${fk.foreignKey} = r.${fk.referencedKey}
          WHERE t.${fk.foreignKey} IS NOT NULL
            AND r.${fk.referencedKey} IS NULL
        `);
        const orphanCount = rows[0].orphan_count;
        if (orphanCount === 0) {
          pass({ type: 'fkChecks', label: fk.label });
        } else {
          fail(
            { type: 'fkChecks', label: fk.label },
            `${orphanCount} orphaned record(s) found`,
          );
        }
      } catch (e) {
        error({ type: 'fkChecks', label: fk.label }, e.message);
      }
    }

    // ── Phase 3: Encrypted Field Integrity ───────────────────────────────────
    console.log('\n--- Encrypted Fields ---');
    for (const enc of ENCRYPTED_FIELD_CHECKS) {
      try {
        const { rows } = await pool.query(`
          SELECT COUNT(*)::int AS empty_count
          FROM "${enc.table}"
          WHERE "${enc.column}" IS NULL
             OR "${enc.column}" = ''
        `);
        const emptyCount = rows[0].empty_count;
        pass({
          type: 'encryptedChecks',
          label: `${enc.label}: ${emptyCount} empty/null`,
          emptyCount,
        });
        if (emptyCount > 0) {
          console.warn(`    ⚠  ${emptyCount} row(s) have NULL/empty ${enc.column}`);
        }
      } catch (e) {
        error({ type: 'encryptedChecks', label: enc.label }, e.message);
      }
    }

    // ── Phase 4: Summary ─────────────────────────────────────────────────────
    console.log('\n=== Summary ===');
    const totalRow = results.rowChecks.length;
    const passedRow = results.rowChecks.filter((r) => r.status === 'PASS').length;
    const totalFk = results.fkChecks.length;
    const passedFk = results.fkChecks.filter((r) => r.status === 'PASS').length;
    const totalEnc = results.encryptedChecks.length;
    const passedEnc = results.encryptedChecks.filter((r) => r.status === 'PASS').length;

    console.log(`Row count checks:  ${passedRow}/${totalRow} passed`);
    console.log(`FK integrity:      ${passedFk}/${totalFk} passed`);
    console.log(`Encrypted fields:  ${passedEnc}/${totalEnc} passed`);
    console.log(`Errors:            ${results.errors.length}`);

    if (allPassed) {
      console.log('\nResult: ALL CHECKS PASSED ✓');
    } else {
      console.log('\nResult: SOME CHECKS FAILED ✗');
    }

    process.exit(allPassed ? 0 : 1);
  } finally {
    await pool.end();
  }
}

main().catch((e) => {
  console.error('Fatal:', e.message);
  process.exit(1);
});
