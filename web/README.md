# FRIDA Domain Check

A bilingual domain checker using one Next.js server, a private PostgreSQL database,
central FRIDA OIDC sign-in and private catalog images on persistent local storage.
This is the second sandbox, separate from Digital Documents.

The selected setup starts empty. It creates business tables and a functional
provider/category catalog, with no demo users or reports. No old Supabase data is
imported. Historical SQL under `supabase/migrations` is retained for reference and
must never be used to initialize this target.

Use Node 24.21.0 / npm 11.19.0. Install with `npm ci` and
`npm ci --prefix deployment`. Configuration is in `.env.example`; credentials
belong in server-owned secret files. The application expects an HTTPS origin and
central OIDC client even in a browser development environment. Password login,
registration and password recovery are retired; new approved OIDC identities get
the local `user` role. An operator grants local admin permission explicitly.

```bash
npm test
npm run test:integration
npm run lint
npm run check:env
npm run build
```

Integration tests need PostgreSQL >=16 tools and OpenSSL. The test wrapper creates
and removes its own temporary Unix-socket-only cluster; it never uses an existing
database or provider account. Legacy Supabase Playwright fixtures are historical,
not evidence for this implementation.

See `deployment/README.md` for provisioning, sessions, maintenance and remaining
production gates; `deployment/VERIFICATION.md` records local checks. The app and
tools Dockerfiles and gated GitHub workflow are prepared. Publication and server
activation remain disabled until real infrastructure acceptance is recorded.
