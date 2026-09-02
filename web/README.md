# FRIDA Domain Check

FRIDA is a bilingual domain-security checker built for Vercel and Supabase.
Supabase Auth owns identity, Supabase Postgres stores the five application tables, and Supabase Storage stores catalog assets. Domain checks are persisted in Postgres and advanced by the lease-based worker while the active results page is open; the protected batch endpoint remains available for an external scheduler.

## Local development

1. Create or select the Supabase project used by the application.
2. Copy `.env.example` to `.env.local` and fill in the Supabase, Cysmo, and cron values. Never commit `.env.local` and never copy it into a container image.
3. If this is replacing the former Mendix-parity schema, export and verify a backup and confirm the current Supabase credentials before applying the migration. It intentionally removes the listed legacy application tables and cannot be rolled back as a data-preserving operation. Then apply the clean baseline from the Supabase dashboard SQL editor or with the Supabase CLI:

   ```bash
   supabase db push
   ```

4. Configure Supabase Auth email templates and redirect URLs for:
   - `http://localhost:3000/auth/callback`
   - `https://<production-domain>/auth/callback`
5. Start Next.js:

   ```bash
   npm install
   npm run dev
   ```

The supported providers are Cysmo for domain checks and PANTA CYBER for synchronous email/phone breach queries. Their credentials stay in Vercel environment variables and are selected by the `provider_key` stored in `domain_check_providers`.

## Environment

The required variables are documented in `.env.example`:

- Supabase URL, anon key, and service-role key
- Cysmo base URL, client ID, and client secret
- PANTA API base URL and API key
- `CRON_SECRET`, `DOMAIN_CHECK_MAX_PER_USER`, `NEXT_PUBLIC_BASE_URL`, and optional admin bootstrap credentials

Supabase Auth handles confirmation, recovery, and reset emails. Configure custom SMTP and email templates in Supabase under Authentication settings. The application does not contain an SMTP client, email queue, email tables, or admin email-configuration screens.

No Vercel Cron jobs are registered because the Vercel Hobby plan only supports once-daily schedules. The saved-check page cooperatively advances the active check through the protected, lease-based worker logic while it is open, so an active scan does not depend on a paid scheduler. The protected `/api/cron/process-domain-checks` endpoint remains available for a future external scheduler or manual operations if abandoned checks must also be processed.

## Database safety

`supabase/migrations/20260813000000_initial.sql` replaces the enumerated app-owned tables and does not touch Supabase system schemas. The follow-up `20260813000001_on_demand_domain_check_claim.sql` adds the per-check lease function used by active results pages. The old custom users and Mendix-parity data are intentionally not migrated. Do not apply either migration until the backup and credential checks above have succeeded.

Admin access is bootstrapped through the protected service-role operation below; no default admin password is stored in this repository. If `ADMIN_EMAIL` and `ADMIN_PASSWORD` are configured in Vercel, the build makes that account idempotently exist and keeps its profile role set to `admin`.

After the migration is applied, either configure `ADMIN_EMAIL` and `ADMIN_PASSWORD` in Vercel or run the bootstrap command once from a trusted machine. Remove temporary credentials from shell history and CI after use:

```bash
npm run bootstrap:admin -- admin@example.com '<temporary-password>' Admin User
```

The script is idempotent: an existing account is promoted to admin. Manual runs change its password when one is supplied; the build-time path does not reset an existing password on every deployment.

## Verification

```bash
npm test
npm run lint
npm run build
```

The unit suite covers the URL/domain result parser, Cysmo adapter contract, queue state normalization, authentication boundary behavior, and saved-check view model. End-to-end tests require a dedicated Supabase test project and mocked provider credentials; a live Cysmo smoke test should be run separately and only when explicitly enabled.
