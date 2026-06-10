# Cyber — Local Standalone App

## Start

```bash
docker compose up -d postgres
npm run dev
```

Open http://localhost:3000

## Login

- **Email:** `admin@example.com`
- **Password:** `Test1234!`

## Troubleshooting

```bash
# Local PostgreSQL blocking port 5432?
brew services stop postgresql@14

# Turbopack cache error?
rm -rf .next

# Rebuild fresh database?
docker compose down -v && docker compose up -d postgres
npx tsx src/lib/seed-languages.ts
```
