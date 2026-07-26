# Urlaubsverwaltung

Multi-user vacation management for a company: employees request leave, admins
approve or reject it, and everyone can see who is off on the team calendar.
Entitlement math follows German rules — statutory + contractual days, per-state
public holidays, pro-rated join year, and carry-over.

## Stack

- **web** — React + Vite, Clerk for auth, TanStack Query
- **api** — Fastify + Prisma + PostgreSQL, Clerk token verification
- **shared** — `@urlaub/shared`: entitlement/holiday math and the HTTP wire contracts both sides import

npm workspaces monorepo under `packages/`.

## Local development

Requires Node 20+ and a PostgreSQL instance.

```bash
npm install

# packages/api/.env  — see packages/api/.env.example
#   DATABASE_URL, TEST_DATABASE_URL, CLERK_SECRET_KEY, WEB_ORIGIN, PORT,
#   ALLOWED_EMAIL_DOMAINS
# packages/web/.env  — see packages/web/.env.example
#   VITE_API_URL, VITE_CLERK_PUBLISHABLE_KEY

npm --workspace packages/api run prisma:migrate   # apply schema
npm --workspace packages/api run prisma:seed      # optional demo data

npm run dev:api    # http://localhost:3002
npm run dev:web    # http://localhost:5173
```

Sign-in is restricted to the domains in `ALLOWED_EMAIL_DOMAINS`. New users start
as `member`; promote to `admin` directly in the database (there is no
self-service promotion).

## Test & build

```bash
npm test     # all workspaces (Vitest)
npm run build
```
