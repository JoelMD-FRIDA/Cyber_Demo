# Server integration

Domain Check uses the infrastructure's `next-postgres` layout: one Next server,
one isolated PostgreSQL 18 database and persistent private catalog images.
Migration/backup/verification/smoke containers are temporary maintenance jobs,
not additional running application servers. No Supabase service is required.
The user selected a fresh empty sandbox; there is no historical data transfer.

## Runtime configuration and identity

The server supplies `.env.example` values through a restricted app env file.
`DATABASE_URL` uses `frida_domain_app`, never the database owner. Set
`ASSET_DIRECTORY=/app/assets`, `APP_ORIGIN` to the exact HTTPS origin (no trailing
slash), and a distinct central OIDC client using client_secret_basic and RS256.
Register exactly `APP_ORIGIN/auth/callback`. The issuer must expose discovery,
authorization, token and JWKS endpoints at its own HTTPS origin. Allow that host
through the infrastructure's private identity exception.

Request scopes are `openid profile email groups`. Require a verified email and
an explicit sandbox entitlement via `OIDC_REQUIRED_ENTITLEMENT_CLAIM/VALUE`.
Real Authelia claims/client configuration and cross-sandbox SSO must be rehearsed;
a staff group never automatically grants an application admin role.
Identity is linked by exact issuer+subject; email collisions fail for review.
Password/reset/signup and admin credential provisioning no longer exist.

Sessions are random host-only secure cookies with hashed identifiers in the DB.
Session lifetime is at most 60 seconds and never exceeds the signed ID token's
expiry. No refresh/access token is kept. A protected page returns through central
SSO on expiry, bounding entitlement staleness to 60 seconds; local disable/role
changes are read on each request. This relies on the IdP's current entitlement
claims on each authorization. Verify real account/group revocation there before
activation. Logout clears this app's session; it does not log out other clients.
Mutations require exact Origin plus a session-bound CSRF header. Bearer tokens
cannot authenticate the browser APIs. Use a base64 32-byte encryption key for
short-lived encrypted OIDC transactions; losing it invalidates pending logins.

Provider credentials are independent from login credentials. Configure only
approved provider endpoints/accounts; tests use mocks and incur no paid checks.
The lifetime quota is 10 per user by default, not daily. Reports persist in the
DB; a retention policy and measured storage limits are still server decisions.

## Fresh setup and maintenance commands

`Dockerfile.tools` has ENTRYPOINT `node /tools/tools.mjs`. Supply command arrays
`["migrate"]`, `["backup"]`, `["verify"]`, `["smoke"]` in the host registration.
For local maintenance, `node deployment/tools.mjs COMMAND` runs the same tool.
Do not put a second `node` executable into the Compose command array.

Use separate app, engine, owner/migration, backup and smoke env files. Owner and
backup libpq service files must be absolute, regular, sandbox-scoped, mode 0600
(or 0400), with section `[frida]` and keys `host`, `port`, `dbname`, `user`,
`password`, `sslmode` (optional `sslrootcert` for verify-full). Private container
DB connections may use sslmode=disable; no DB port is published.

During the later explicitly activated setup, an operator must:

1. Provision the pinned engine and empty DB `domain_check`, owner
   `frida_domain_owner`. Engine env includes `POSTGRES_DB=domain_check`,
   `POSTGRES_USER=frida_domain_owner`, a strong server-owned `POSTGRES_PASSWORD`,
   and `PGDATA=/var/lib/postgresql/18/docker`. PostgreSQL 18's persistent mount is
   `/var/lib/postgresql`, owned by container UID/GID 999:999 after rootless mapping.
2. With owner credentials and `FRIDA_EMPTY_INSTALL=true`, run `provision` once to
   create `frida_domain_app` and `frida_domain_backup` using separate
   `FRIDA_APP_DB_PASSWORD` and `FRIDA_BACKUP_DB_PASSWORD` values (at least 24 chars).
   Run `init` once with the same explicit empty-install switch. Remove temporary
   provisioning secrets afterward. An existing/populated unknown DB is refused;
   no command resets it. A partial role provisioning failure needs operator review.
3. Give app and backup their own matching credentials. Later automatic jobs run
   `migrate`, which requires an existing checksum ledger and applies only reviewed
   ordered migrations under a database lock/transaction. Never replay the legacy
   SQL. Image rollback never restores an older database.
4. Create persistent `uploads` and `backup-staging` directories mapped to
   `/app/assets` and `/backup-staging`, writable by mapped tools UID 10001.
   App assets survive replacement; backups mount them read-only. The staging
   directory is disk-backed under the sandbox quota, not a large memory tmpfs.
5. Run owner-only `create-probe` and set the printed non-secret UUID as
   `DEPLOYMENT_PROBE_PROFILE_ID`. It is an inactive synthetic user and cannot sign
   in. App `DEPLOYMENT_PROBE_SECRET` and smoke `SMOKE_TOKEN` share a distinct random
   secret of at least 32 chars; smoke `SMOKE_BASE_URL=http://app:3000`. This token
   allows only the read-only internal probe, no browser API or paid checks.
6. After the intended administrator signs in, use owner-only
   `grant-admin ISSUER SUBJECT` to assign that already mapped identity local admin.
   No first visitor is automatically an administrator.

Initialization is separate from the automatic rollout path: that path requires a
running, initialized DB and a valid backup before migration. It cannot bootstrap
an unknown database by pretending an empty backup is valid.

## Backups, queue and health

`backup` holds an exclusive application write barrier, drains active write/provider
leases, pauses new writes, and emits a tar bundle on stdout. It contains a custom
pg_dump plus all catalog PNG bytes and a checksum manifest. No raw live database
files are copied. `verify` consumes stdin with no network or DB credential and
checks archive paths/types, all hashes and pg_restore's listing.

`restore` is owner-only, takes stdin and requires `FRIDA_EMPTY_RESTORE=true`, an
empty different database name and an empty assets directory. Restore targets must
be isolated with fresh credentials, no app/scheduler or external provider access.
Afterward session/login transactions are invalidated and scoped grants restored.
This is a recovery test procedure, never automatic database rollback. Incomplete
restore remains an isolated failed target for review; no live DB is overwritten.

Bundle limit: 256 MiB; manifest: 1 MiB; at most 10,000 immutable assets. Allow disk
headroom for archive, extracted content and temporary dump concurrently. Tools
clean their own scoped temporary directory on normal completion. A hard kill can
leave staging files and maintenance=true: inspect the interrupted job first,
then use owner-only `resume`; never automatically erase or resume unknown work.
The infrastructure handles encrypted off-server copies/retention; its destination
and restricted credentials are still missing. Local bundle tests do not establish
an off-server recovery service.

Queue claims are one job at a time with 120-second leases and a fencing token.
Provider steps have bounded bodies/deadlines. Submission intent is committed
before a paid call; ambiguous submission becomes a failed job requiring operator
reconciliation, never an automatic paid resubmission. Known remote job IDs can be
polled again. GET reads have no paid side effect; protected POST advances work.
The private cron endpoint denies all calls without its own `CRON_SECRET`.
Keep unattended scheduling disabled until actual operational acceptance.

`/api/health/live` has no dependencies. `/api/health/ready` validates configuration,
OIDC discovery, runtime SQL role/schema checksum/required columns, maintenance
state and writable asset storage. Provider keys can be added after setup:
readiness reports `capabilities.checks=disabled` while the app remains available;
unconfigured providers cannot create checks or consume quota. Missing DB/SSO/assets
still returns generic 503 within the readiness budget. No paid provider is called.
`/api/internal/deployment-probe` additionally checks its scoped credential/inactive
probe identity and read access. The public limiter blocks internal/cron/health
paths; private container/loopback monitoring remains available.

## Delivery and remaining production proof

Credential-free CI includes unit tests, disposable PostgreSQL/OIDC/assets/restore
tests, lint, env checks and build. GitHub-hosted release publication requires both
`FRIDA_INTEGRATION_READY=true` and all checked-in contract acceptance flags. They
remain false. Legacy SQL is never an automatic migration input. The host separately
verifies main/workflow/image provenance and real runtime acceptance.

Still required: reviewed main revision, actual Linux container builds/readonly UID
execution, real domain/SSO client and revocation, provider configuration, rootless
network/resource enforcement, disk quota, encrypted off-server restore, actual
readiness/smoke and compatible rollout/rollback evidence. This checkout does not
activate routes, install services, publish images or change production data.
