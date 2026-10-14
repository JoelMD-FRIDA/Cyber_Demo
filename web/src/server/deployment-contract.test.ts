// @vitest-environment node
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, copyFileSync, writeFileSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { afterEach, describe, expect, it } from 'vitest';

const temporary: string[] = [];
afterEach(() => { for (const path of temporary.splice(0)) rmSync(path, { recursive: true, force: true }); });

function fixture(sql = 'ALTER TABLE profiles ADD COLUMN IF NOT EXISTS test_flag boolean;') {
  const root = mkdtempSync(join(tmpdir(), 'frida-contract-'));
  temporary.push(root);
  mkdirSync(join(root, 'scripts'));
  mkdirSync(join(root, 'deployment/migrations'), { recursive: true });
  copyFileSync(resolve('scripts/check-deployment.mjs'), join(root, 'scripts/check-deployment.mjs'));
  const contract = JSON.parse(readFileSync(resolve('deployment/contract.json'), 'utf8'));
  contract.automatic_deployment = true;
  contract.compatibility = 'additive';
  for (const name of Object.keys(contract.acceptance)) contract.acceptance[name] = true;
  contract.tools_dockerfile = 'deployment/Dockerfile.tools';
  writeFileSync(join(root, contract.tools_dockerfile), '# synthetic static-check fixture');
  const file = '20261014000000_forward.sql';
  writeFileSync(join(root, 'deployment/migrations', file), sql);
  contract.reviewed_migrations = [{ file, sha256: createHash('sha256').update(sql).digest('hex') }];
  return { root, contract, run() {
    writeFileSync(join(root, 'deployment/contract.json'), JSON.stringify(contract));
    return spawnSync(process.execPath, [join(root, 'scripts/check-deployment.mjs')], { encoding: 'utf8' });
  } };
}

describe('publication migration gate', () => {
  it('refuses the real incomplete source contract', () => {
    const result = spawnSync(process.execPath, ['scripts/check-deployment.mjs'], { encoding: 'utf8' });
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Deployment disabled');
  });

  it('does not publish DROP CASCADE SQL even with acceptance assertions set', () => {
    const f = fixture('DROP TABLE public.domain_checks CASCADE;');
    const result = f.run();
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('Destructive SQL');
  });

  it('requires migration checksums to match reviewed content', () => {
    const f = fixture();
    writeFileSync(join(f.root, 'deployment/migrations', f.contract.reviewed_migrations[0].file), 'TRUNCATE profiles;');
    expect(f.run().stderr).toContain('checksum changed');
  });

  it('never points automatic migration tooling at the legacy baseline directory', () => {
    const f = fixture();
    f.contract.reviewed_migrations_directory = 'supabase/migrations';
    expect(f.run().stderr).toContain('legacy destructive baseline');
  });
});
