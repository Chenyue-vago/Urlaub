---
name: run-app
description: Use when asked to run, start, launch, or smoke-test the Urlaub app locally, or to confirm "is the system up?" — launches the API (Fastify) and web (Vite) dev servers and verifies them end to end.
---

# Running the Urlaub app

Monorepo (`packages/api`, `packages/web`, `packages/shared`). "Running"
means both dev servers up **and** verified — not just ports listening.

## Prerequisites (verify first, don't assume)

- Deps installed: root `node_modules` exists (`npm install` at root if not).
- `.env` files present: `packages/api/.env`, `packages/web/.env`
  (copy from the `.env.example` siblings if missing).
- **PostgreSQL reachable on `localhost:5432`** — the API needs it:
  ```bash
  (exec 3<>/dev/tcp/localhost/5432) 2>/dev/null && echo REACHABLE || echo DOWN
  ```
  If down, start it (e.g. `docker compose up -d db`, or the local pg service)
  before launching the API.

## Ports (from the committed .env)

- **API**: `PORT=3002` (default in `env.ts` is 3000 — the `.env` overrides it).
- **Web**: Vite on `5173`. `VITE_API_URL=http://localhost:3002` must match the API port.

## Launch

Run each in the background (they're long-lived `watch`/`vite` processes):

```bash
npm run dev:api   # tsx watch src/server.ts  → :3002
npm run dev:web   # vite (has a predev holiday-extract step) → :5173
```

## Verify (this is the point — drive it, don't just launch)

```bash
# API health
curl -s -w '\n[%{http_code}]\n' http://localhost:3002/health      # → {"status":"ok"} [200]

# Auth guard is live: a real route with no token must 401
curl -s -w '\n[%{http_code}]\n' http://localhost:3002/me           # → Unauthenticated [401]

# Web serves the app shell
curl -s http://localhost:3002/../ ; curl -s http://localhost:5173/ | grep -E '<title|id="root"'  # → <title>Urlaubsverwaltung</title>, <div id="root">
```

All three passing = system is up. A 200 on `/me` (instead of 401) means the
auth guard regressed; a 404 means you used the wrong path — routes are
mounted at the root (`/me`, `/calendar`, `/leave-requests`, `/balance`,
`/admin/users`, `/settings`), **not** under `/api`.

## Notes

- The API `/health` route needs no DB, but every business route (`/me`, etc.)
  hits Prisma → Postgres. If `/health` is 200 but `/me` 500s, check the DB.
- To exercise an authenticated route, pass a Clerk bearer token
  (`Authorization: Bearer <jwt>`); without one, 401 is the correct response.
