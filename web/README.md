# FRIDA Domain Check

FRIDA is a bilingual domain-security checker built for Vercel and Supabase.
Supabase Auth owns identity, Supabase Postgres stores the five application tables, and Supabase Storage stores catalog assets. Domain checks are queued in Postgres and processed by the protected worker endpoint when an external scheduler invokes it.

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

The first supported provider is Cysmo. Its credentials stay in Vercel environment variables and are selected by the `provider_key` stored in `domain_check_providers`.

## Environment

The required variables are documented in `.env.example`:

- Supabase URL, anon key, and service-role key
- Cysmo base URL, client ID, and client secret
- `CRON_SECRET`, `DOMAIN_CHECK_MAX_PER_USER`, and `NEXT_PUBLIC_BASE_URL`

There is no application SMTP, JWT, PGP, LDAP, or local-Postgres configuration. Password confirmation, recovery, and reset emails are configured in Supabase Auth.

No Vercel Cron jobs are registered because the Vercel Hobby plan only supports once-daily schedules. The protected `/api/cron/process-domain-checks` endpoint remains available for a future external scheduler or manual operations. Until one is configured, newly queued domain checks will remain queued.

## Database safety

`supabase/migrations/20260813000000_initial.sql` replaces the enumerated app-owned tables and does not touch Supabase system schemas. The old custom users and Mendix-parity data are intentionally not migrated. Do not apply it until the backup and credential checks above have succeeded.

Admin access is bootstrapped through a one-time protected Supabase operation; no default admin password is stored in this repository.

After the migration is applied, run the bootstrap command once from a trusted machine, then remove the temporary credentials from your shell history and CI environment:

```bash
npm run bootstrap:admin -- admin@example.com '<temporary-password>' Admin User
```

## Verification

```bash
npm test
npm run lint
npm run build
```

The unit suite covers the URL/domain result parser, Cysmo adapter contract, queue state normalization, authentication boundary behavior, and saved-check view model. End-to-end tests require a dedicated Supabase test project and mocked provider credentials; a live Cysmo smoke test should be run separately and only when explicitly enabled.
