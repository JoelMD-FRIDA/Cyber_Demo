# Server integration status

This is FRIDA Domain Check, the second sandbox, identifier `frida-domain-check`.
The target is a single Next server with isolated local PostgreSQL, persistent
catalog assets and the central OIDC login. Current application queries/auth/uploads
still use Supabase; the database, identity and Storage migration is not implemented.
No live deployment, data transfer or application acceptance is claimed.

Preparation removes build-time admin mutation, generates Next standalone output,
adds a digest-pinned non-root Dockerfile with explicit safe copies, documents all
current environment references, and bounds/redacts provider HTTP. The historical
manual bootstrap tool is not run by build/start. No production credentials belong
in CI or Docker arguments. Use Node 24.21.0 / npm 11.19.0 for these checked changes.

The private `/api/health/live` returns 200 without external calls.
`/api/health/ready` deliberately returns 503: this source cannot serve the target
architecture yet. Replace that refusal only with actual bounded DB/schema/assets/
session checks as part of the application migration. A static page or an env flag
cannot establish readiness. The HTTP deadline changes do not establish safe worker
leases, fencing or crash reconciliation; unattended scheduling stays disabled.

The workflow `.github/workflows/frida-release.yml` runs credential-free tests,
lint, env checks and build on PRs/main. Publication requires both the repository
variable `FRIDA_INTEGRATION_READY=true` and a passing checked-in deployment contract.
The contract is disabled. `npm run check:deployment` intentionally fails until
actual PostgreSQL/OIDC/assets/restore/queue/readiness acceptance and a reviewed tools
image/migration manifest exist. Its SQL text checks are defense in depth, not proof
of arbitrary SQL safety or a migration runner. The host separately verifies signed
main/workflow/source/image provenance and complete runtime acceptance.

The legacy SQL is unchanged. Never replay its destructive initial baseline against
populated data, automatically reset data, or restore an old DB backup for image
rollback. Add reviewed new migrations with checksum ledger/advisory locks and
rehearse UUID/ownership/quota preservation and PostgreSQL plus asset restore.
The target tools Dockerfile and executable adapters do not exist yet; do not
substitute invented migration/backup commands or publish this as activation-ready.

The server integration record and exact remaining work live in
`/home/itadmin/frida-infra/integrations/frida-domain-check/README.md`.
