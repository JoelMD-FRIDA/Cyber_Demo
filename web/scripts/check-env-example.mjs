#!/usr/bin/env node

/**
 * check-env-example.mjs
 *
 * Validates that every process.env.XXX reference in web/src/ has a
 * corresponding non-secret entry in web/.env.example.
 *
 * Usage:
 *   node scripts/check-env-example.mjs
 *
 * Exit codes:
 *   0 — all covered (or only expected skips)
 *   1 — one or more env vars are missing from .env.example
 */

import { readFileSync, readdirSync } from "fs";
import { join, extname } from "path";
import { fileURLToPath } from "url";

const ROOT = join(fileURLToPath(new URL("..", import.meta.url)), ".");
const SRC = join(ROOT, "src");
const ENV_EXAMPLE = join(ROOT, ".env.example");

// ---------------------------------------------------------------------------
// 1. Gather every process.env.XXX reference from .ts / .tsx files
// ---------------------------------------------------------------------------

/** Recursively walk a directory returning file paths. */
function walk(dir) {
  const files = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
    } else if (entry.isFile()) {
      files.push(full);
    }
  }
  return files;
}

const envVarRe = /process\.env\.([A-Z_][A-Z0-9_]*)/g;
const found = new Set();

for (const file of walk(SRC)) {
  const ext = extname(file);
  if (ext !== ".ts" && ext !== ".tsx") continue;
  if (file.endsWith(".test.ts") || file.endsWith(".test.tsx")) continue; // skip test files — they set their own

  const content = readFileSync(file, "utf-8");
  let match;
  while ((match = envVarRe.exec(content)) !== null) {
    found.add(match[1]);
  }
}

// ---------------------------------------------------------------------------
// 2. Parse .env.example
// ---------------------------------------------------------------------------

const exampleContent = readFileSync(ENV_EXAMPLE, "utf-8");
const exampleLines = exampleContent.split("\n");

const exampleVars = new Set();
for (const line of exampleLines) {
  const trimmed = line.trim();
  // match VAR_NAME=value or VAR_NAME=
  const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
  if (m) exampleVars.add(m[1]);
}

// ---------------------------------------------------------------------------
// 3. Compare
// ---------------------------------------------------------------------------

const knownSkips = new Set([
  // NODE_ENV is a standard Node.js runtime variable — never in .env.example
  "NODE_ENV",
]);

const missing = [];
for (const v of found) {
  if (!exampleVars.has(v) && !knownSkips.has(v)) {
    missing.push(v);
  }
}

const fnOnly = [...exampleVars].filter((v) => !found.has(v));
const covered = [...found].filter((v) => exampleVars.has(v));

console.log("─".repeat(56));
console.log("  check-env-example.mjs — Coverage Report");
console.log("─".repeat(56));
console.log(`  Source files scanned : ${walk(SRC).filter((f) => /\.tsx?$/.test(f) && !/\.test\.(ts|tsx)$/.test(f)).length}`);
console.log(`  process.env refs found  : ${found.size}`);
console.log(`  .env.example entries    : ${exampleVars.size}`);
console.log(`  Covered               : ${covered.length}`);
console.log(`  Missing from example   : ${missing.length}`);

if (missing.length > 0) {
  console.log("\n  ❌ MISSING from .env.example:");
  for (const v of missing.sort()) {
    console.log(`     - ${v}`);
  }
  console.log("\n  → Add these to .env.example, then re-run.");
  process.exit(1);
}

if (fnOnly.length > 0) {
  console.log("\n  ℹ️  In .env.example but never referenced in src/ (noise):");
  for (const v of fnOnly.sort()) {
    console.log(`     - ${v}`);
  }
}

console.log("\n  ✅ All process.env references are covered by .env.example");
process.exit(0);
