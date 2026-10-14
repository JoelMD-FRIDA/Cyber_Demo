# Local verification — 14 October 2026

Starting source: `dbaecb6a8e3291ac75d57b5f0e4c00267d3c4d1a`, public
`JoelMD-FRIDA/Cyber_Demo`, main/default ref verified at intake. Work is on the
local review branch `codex/domain-check-infrastructure`; nothing was pushed.
The user explicitly selected an empty sandbox, with no existing data transfer.

## Checks actually run

| Check | Result |
| --- | --- |
| Unit suite | 39 tests / 15 files pass |
| Real PostgreSQL integration suite | 14 tests pass, temporary PostgreSQL 18.6 cluster and local TLS OIDC fixture |
| Production build | Next 16.4.1 compilation, TypeScript and standalone output pass without credentials |
| Lint | No errors; three image optimization warnings |
| Environment example | All 19 source references covered |
| Production dependency audit | Zero reported vulnerabilities at the time of this run |
| Release gate | Expected refusal: production acceptance/automatic delivery remains false |
| Standalone HTTP smoke | live/login 200; unconfigured ready 503; protected APIs, cron and internal probe 401; temporary process stopped |
| Historical SQL | Legacy Supabase migration files byte-unchanged from starting source |
| Infrastructure framework | 80 tests pass; validate reports zero registrations, two separate blocked intakes, no enabled integration |

The PostgreSQL tests run actual provisioning/initialization/migrations and verify
runtime/backup privileges, checksummed idempotence, refusal of unknown populated
DBs, atomic quotas under concurrency and cross-user reads. They exercise signed
OIDC authorization/code exchange with PKCE/nonce/state, reject signature/issuer/
audience/expiry/entitlement/replay/email-linking failures, and prove that staff/admin
claims do not grant a local admin role. Browser cookie/bearer/CSRF boundaries,
expired/disabled sessions, paid-job ambiguity/fencing, sanitized local images,
positive/negative readiness and the narrow authenticated probe are exercised.

A consistent populated DB+image bundle is produced, validated and restored into a
different empty isolated database. Image bytes match; login/session state is
invalidated. Corrupted bundles are refused. The write barrier blocks mutations.
This is meaningful adapter evidence, not proof of an off-server backup service.

The fixture uses only its own disposable identities/data, an ephemeral Unix
socket and loopback TLS mock. It stops its PostgreSQL process and removes temporary
state afterward. No live IdP, provider account, production database or user data
was contacted. No paid check was made.

## Tooling and limits

Node 24.21.0/npm 11.19.0 and extracted PostgreSQL 18.6 packages are user-cache test
tools, not system installations/services. The official Node archive checksum was
verified: `fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6`.
The official pinned PostgreSQL 18 bookworm Dockerfile documents UID/GID 999 and
`PGDATA=/var/lib/postgresql/18/docker`, mounted at `/var/lib/postgresql`.

No Docker daemon is installed. Actual app/tools images, copied runtime libraries,
rootless UID mappings, readonly container execution, image layers, memory/CPU/disk
limits, network isolation, image attestations and GitHub CI were not exercised.
Real central IdP SSO/group revocation, configured providers, off-server encrypted
restore and actual rollout/rollback remain production acceptance requirements.
No service installation, public route, DNS, firewall, running nginx/mail setting,
repository setting, remote code or automatic deployment was changed.
