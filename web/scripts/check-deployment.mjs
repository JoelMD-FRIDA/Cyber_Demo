#!/usr/bin/env node
// Publication gate, never a migration runner; does not read environment secrets.
import { createHash } from 'node:crypto';
import { readFileSync, realpathSync, readdirSync } from 'node:fs';
import { resolve, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
function requireCondition(ok, message) {
  if (!ok) throw new Error(message);
}
try {
  const contract = JSON.parse(readFileSync(resolve(root, 'deployment/contract.json'), 'utf8'));
  requireCondition(contract.schema === 1 && contract.id === 'frida-domain-check' &&
    contract.target === 'next-postgres', 'Wrong deployment contract.');
  requireCondition(contract.automatic_deployment === true,
    'Deployment disabled: PostgreSQL, central login and asset migration are incomplete.');
  const checks = ['postgres_adapter_verified', 'native_oidc_verified', 'asset_transfer_verified',
    'complete_bundle_restore_verified', 'write_barrier_verified', 'queue_safety_verified',
    'dependency_readiness_verified'];
  for (const key of checks) requireCondition(contract.acceptance[key] === true, `Missing acceptance: ${key}`);
  requireCondition(contract.compatibility === 'additive', 'Manual review required for incompatible schema changes.');
  requireCondition(contract.reviewed_migrations_directory === 'deployment/migrations',
    'Never publish the legacy destructive baseline as automatic migrations.');
  const directory = realpathSync(resolve(root, 'deployment/migrations'));
  requireCondition(relative(root, directory) === 'deployment/migrations', 'Migration directory must stay inside this source tree.');
  requireCondition(Array.isArray(contract.reviewed_migrations) && contract.reviewed_migrations.length > 0,
    'Supply an explicitly reviewed migration manifest.');
  const seen = new Set();
  for (const entry of contract.reviewed_migrations) {
    requireCondition(typeof entry.file === 'string' && /^\d{14}_[a-z0-9_]+\.sql$/.test(entry.file) &&
      !seen.has(entry.file) && /^[a-f0-9]{64}$/.test(entry.sha256), 'Invalid or duplicate migration entry.');
    seen.add(entry.file);
    const path = realpathSync(resolve(directory, entry.file));
    const rel = relative(directory, path);
    requireCondition(!isAbsolute(rel) && rel === entry.file, 'Migration symlink/path escape rejected.');
    const sql = readFileSync(path);
    requireCondition(createHash('sha256').update(sql).digest('hex') === entry.sha256, 'Migration checksum changed.');
    // Defense in depth; the real locked runner and isolated compatibility tests
    // remain mandatory. This text check cannot prove arbitrary SQL is additive.
    requireCondition(!/\b(DROP|TRUNCATE)\b|\bDELETE\s+FROM\b/i.test(sql.toString()),
      'Destructive SQL requires the separate reviewed migration procedure.');
  }
  requireCondition(readdirSync(directory).filter(name => name.endsWith('.sql')).every(name => seen.has(name)),
    'Unreviewed SQL exists in the migration directory.');
  requireCondition(contract.tools_dockerfile === 'deployment/Dockerfile.tools', 'Supply the reviewed tools image build.');
  readFileSync(resolve(root, contract.tools_dockerfile));
  console.log('Deployment contract passes static checks; live framework acceptance is still required.');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'Invalid deployment contract.');
  process.exitCode = 1;
}
