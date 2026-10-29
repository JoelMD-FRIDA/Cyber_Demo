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
Application sessions last seven days and extend during use, with a database
update at most once a day. The signed ID token must be valid at sign-in; its
short token lifetime does not impose minute-by-minute browser reauthentication.
No refresh/access token is kept. Local disable/role changes are read on each
request, and logout deletes this app's session immediately. Central group removal
is checked at the next OIDC sign-in, not every 60 seconds: disable the local
profile or delete its app sessions for immediate Cyber revocation. Logout does
not log out other clients.
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

## Session continuity

Successful OIDC sign-in establishes a persistent seven-day application session.
Active pages check it every five minutes; `/api/auth/me` extends a valid session
and its session/CSRF cookies during use, keeping their identifiers stable.
Authenticated legacy 60-second sessions upgrade through the same endpoint.
Healthy sessions do not open SSO iframes. Temporary network/server failures do
not display a false signed-out banner or start another identity exchange.
Normal sign-in defaults to the check form.

An encrypted, HTTP-only renewal binding ties reauthentication to the original
issuer, subject and local profile for one hour. It never authorizes an API.
Expired/disabled sessions remain denied. Manual sign-in
in a popup requests fresh authentication and must return as the same account.
No access, refresh or ID tokens are retained. This is a recovery path for expired
legacy sessions, not a periodic dependency of persistent sessions. Logout clears
the renewal binding.
Each login transaction now has its own state-derived cookie, so simultaneous
tabs/sign-ins cannot overwrite another request's PKCE context.

The confidential `frida-cyber-web` IdP client needs `consent_mode: implicit` for
silent renewal. Preserve the existing client policy, scopes, PKCE and other
clients. The server activation helper validates and installs this one setting.
An already valid application session now obtains its renewal binding from
`/api/auth/me` using its existing issuer/subject mapping; an upgrade does not
require another sign-in. The response includes a relative session TTL so the
browser can use an already renewed session before opening another OIDC flow.
A missing iframe notification also falls back to checking the actual live session.

Scan processing validates the caller and ownership once at the beginning of the
request, then uses that same scoped context to return its result. Expiry or cookie
rotation during bounded provider work must not turn a successful scan into a 401.
Subsequent requests still enforce session expiry and ownership. A saved-results
page resumes the existing scan after auth recovery or a transient server failure;
retrying that page does not create another queued check.

Identity exchanges have a bounded 30-second timeout: concurrent client-secret
verification on the CPU-limited shared service was measured above four seconds,
the old cutoff. Code grants are never blindly retried. Reloading a consumed
callback preserves an already valid app session instead of showing a login error.
Other callback failures return a retryable login page or signal failed renewal to
the existing page. Logs record only a fixed `FRIDA_LOGIN_FAILED` category without
OAuth codes, tokens, emails or raw upstream errors.

`npm run test:session-browser` exercises the real Cyber form/client in Chromium
against disposable API/OIDC transports, including denied renewal, a scan beyond
the old 60-second limit without SSO, temporary session-service failures, CSRF
retry, exactly one submission and simultaneous tabs. Install the
Playwright browser first or set `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` to a local
Chromium executable. The PostgreSQL suite separately exercises real signed OIDC
code exchanges, expired sessions and identity/entitlement rejection.

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

## Temporary private acceptance images

Same-repository checks for the fixed infrastructure review branch also export
app/tools and the pinned PostgreSQL image into a two-day Actions artifact. The
checkout and manifest bind the exact reviewed head commit and workflow run. No
server credentials, environment files or database data enter the build/artifact.
These are explicitly marked private-acceptance-only and cannot satisfy the
main-release provenance or automatic-deployment contract. The operator must
verify the canonical GitHub artifact digest, run and image contents before any
offline loading; production acceptance flags remain false.

The server migration disables future Vercel Git deployments in `web/vercel.json`
using its documented `git.deploymentEnabled=false` setting. It does not delete
an existing Vercel deployment or alter DNS. Production traffic cutover is separate.
