# Developer Guide — run locally & deploy

Everything needed to run the Urlaub app end-to-end on your machine and to deploy
it. End-user instructions live in [README.md](README.md).

## Architecture

npm workspaces monorepo under `packages/`:

- **web** (`packages/web`) — React + Vite SPA, Clerk for auth, TanStack Query.
- **api** (`packages/api`) — Fastify + Prisma + PostgreSQL, Clerk token verification.
- **shared** (`@urlaub/shared`) — entitlement/holiday math and the HTTP wire
  contracts both sides import.

Deployed as a split frontend/backend: **web → GitHub Pages**, **api + PostgreSQL
→ Railway**, **auth → Clerk**.

> ⚠️ **Build order matters.** `@urlaub/shared`'s `package.json` `main` points at
> its build output (`./dist`). Anything that builds or tests a *single* package
> does **not** build shared first, so a clean environment (CI, Railway, Pages)
> fails with `Cannot find module '@urlaub/shared'` (and missing Prisma types if
> `prisma generate` also hasn't run). This bit us in CI, on Railway, and on
> Pages — and never locally, because a stale `packages/shared/dist/` hides it.
> **Use the root scripts, which build shared first:** `npm run build:api`
> (Railway), `npm run build:web` (Pages), `npm run build` (full). When a build
> passes locally but fails remotely with a module-resolution error, reproduce
> clean first: `rm -rf packages/*/dist node_modules/.prisma`.

---

## Run locally

### 0. Prerequisites

- Node **>= 20**.
- Docker (for the Postgres container).
- `packages/api/.env` — copy from `packages/api/.env.example`, fill in Clerk
  keys. Set `WEB_ORIGIN=http://localhost:5173` and **`PORT=3002`** (port 3000 is
  often taken; the API runs on 3002 here).
- `packages/web/.env` — copy from `packages/web/.env.example`, set
  `VITE_CLERK_PUBLISHABLE_KEY` and `VITE_API_URL=http://localhost:3002`.

The `.env` files are gitignored.

### 1. Start Postgres

```bash
docker compose -f packages/api/docker-compose.yml up -d
```

Creates both the `urlaub` (dev) and `urlaub_test` databases in one container
(`api-postgres-1`).

### 2. Install dependencies (repo root)

```bash
npm install
```

### 3. Migrate + seed the dev database

```bash
npm --workspace packages/api run prisma:migrate
npm --workspace packages/api run prisma:seed
```

The seed is idempotent (safe to re-run). It upserts a 12-person company:

- 3 admins: `founder1@vago-solutions.ai`, `founder2@vago-solutions.ai`,
  `assistant@vago-solutions.ai`
- 9 members: `dev1@vago-solutions.ai` .. `dev9@vago-solutions.ai`

All with placeholder Clerk IDs (they can't actually sign in), plus sample
`leave_requests` around the current date so the Team Timeline and the Admin
Approvals Queue (including a cross-year request split into linked segments via a
shared `group_id`) have realistic content.

### 4. Run the API (port 3002)

```bash
PORT=3002 npm --workspace packages/api run dev
```

Verify: `curl localhost:3002/health` → `{"status":"ok"}`.

### 5. Run the web app (port 5173)

In a second terminal:

```bash
npm --workspace packages/web run dev
```

Open http://localhost:5173.

### 6. First login → become admin

Sign in with your own `@vago-solutions.ai` email via Clerk. On first login the
API's `resolveUser` auto-creates your user row as `member`. To see the admin
views, promote yourself once via SQL:

```bash
docker exec -i api-postgres-1 psql -U urlaub -d urlaub \
  -c "UPDATE users SET role='admin' WHERE email='YOUR_EMAIL@vago-solutions.ai';"
```

Refresh the app afterwards. (There is no self-service promotion — this is also
how you bootstrap the first admin in production.)

## Test & build

```bash
npm test        # all workspaces (Vitest); API tests need TEST_DATABASE_URL + Postgres
npm run build   # full monorepo build (shared → api → web)
```

---

## Deploy

Split frontend/backend. GitHub Pages hosts only static files, so the API and
database live on Railway; the frontend talks to the API over HTTPS.

```
GitHub Pages (web)  ──HTTPS──▶  Railway (api)  ──▶  Railway PostgreSQL
   VITE_API_URL                  WEB_ORIGIN = Pages origin (CORS)
   VITE_CLERK_PUBLISHABLE_KEY    CLERK_SECRET_KEY
         └──────────── Clerk (hosted login) ────────────┘
```

| Piece | Where | How it deploys |
| --- | --- | --- |
| `packages/web` | **GitHub Pages** (`chenyue-vago.github.io/Urlaub/`) | `.github/workflows/deploy.yml` on push to `main` |
| `packages/api` | **Railway** | `railway.json` on push to `main` |
| PostgreSQL | **Railway** (managed) | provisioned once in the Railway project |
| Auth | **Clerk** | configured in the Clerk dashboard |

### Clerk

We use the Clerk **Development** instance (`pk_test_`/`sk_test_`) on purpose: the
site has no custom domain we can set DNS on, and Clerk *production* instances
require DNS verification that `github.io` can't satisfy. Add
`https://chenyue-vago.github.io` to the instance's allowed origins. Email/password
sign-in is enabled; sign-up is restricted to `@vago-solutions.ai` by the API's
`ALLOWED_EMAIL_DOMAINS`.

### Railway (backend + database)

1. Create a Railway project from this GitHub repo, deploying branch `main`.
   Railway reads `railway.json` (build `npm run build:api`; start runs
   `prisma migrate deploy` then `node dist/server.js`).
   - The `nixpacksPlan` form of `railway.json` was ignored by Railway; a
     top-level `buildCommand` works.
   - Keep **Root Directory** at the repo root (the whole workspace must install
     so `@urlaub/shared` resolves).
   - Enable **Wait for CI** so a red CI blocks the deploy.
2. Add a **PostgreSQL** database (New → Database → PostgreSQL).
3. On the API service, set Variables:

   | Variable | Value |
   | --- | --- |
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
   | `WEB_ORIGIN` | `https://chenyue-vago.github.io` (no path, no trailing slash) |
   | `CLERK_SECRET_KEY` | from Clerk |
   | `CLERK_PUBLISHABLE_KEY` | from Clerk |
   | `ALLOWED_EMAIL_DOMAINS` | `vago-solutions.ai` |

   Do **not** set `PORT` — Railway injects it (8080); the server reads `env.PORT`
   and listens on `0.0.0.0`.
4. Generate a public domain (Settings → Networking; target port 8080). Check
   `curl https://<railway-url>/health` → `200`.

First deploy runs `prisma migrate deploy` against an empty DB. It does **not**
seed. Create real users by signing in (the API upserts a user row on first
authenticated request), then bootstrap the first admin via SQL (see step 6
above, but against the Railway DB — use its public connection string).

### GitHub (frontend build config)

The web build inlines its config at build time (Vite `VITE_*`). In **Settings →
Secrets and variables → Actions**:

| Kind | Name | Value |
| --- | --- | --- |
| **Variable** | `VITE_API_URL` | the Railway URL, e.g. `https://urlaub-production.up.railway.app` |
| **Secret** | `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key (`pk_test_…`) |

`deploy.yml` fails the build loudly if either is missing. Also set **Settings →
Pages → Source = GitHub Actions**.

Because the app is served under the `/Urlaub/` subpath, the frontend keeps
routing and Clerk redirects under `import.meta.env.BASE_URL`, and a
`public/404.html` fallback lets deep links (e.g. `/Urlaub/admin`) survive a
direct load / refresh on static Pages hosting.

### Deploy flow

- **Push to `main`** → `deploy.yml` rebuilds and publishes the frontend; Railway
  rebuilds and redeploys the API (running any new migrations).
- **Pull requests** → `ci.yml` runs `npm test` + `npm run build` against a
  throwaway Postgres. `main` is branch-protected on this check (required
  approvals set to 0, so CI is the gate).

### Post-deploy smoke test

1. Open `https://chenyue-vago.github.io/Urlaub/` — login page loads, no console
   CORS errors.
2. Sign in with a company email → dashboard loads real balance data.
3. Submit a leave request → appears as pending.
4. As admin, approve it → status flips, audit log records it.
5. Refresh a deep link (e.g. `/Urlaub/admin`) → loads, not a 404.

Blank page → check `VITE_API_URL` / `VITE_CLERK_PUBLISHABLE_KEY` were set before
the Pages build. CORS error → check the API's `WEB_ORIGIN` exactly equals
`https://chenyue-vago.github.io`.

## Troubleshooting: "Failed to load, please try again"

The dashboard shows this generic error whenever a data request fails, and it has
had a **different root cause almost every time** — don't guess, work top-down.
It's almost always the **API side** (the page shell renders, then a `fetch`
fails). The auth layer collapses every failure into a bare `401`, and the two
`catch {}` blocks in `packages/api/src/auth/clerk.ts` swallow the real reason.

1. **Is the API running?** (most common locally: a clean build that runs
   `rm -rf packages/*/dist node_modules/.prisma` kills the `tsx watch` API while
   the Vite server survives — so the page loads but every request fails.)
   ```bash
   curl -s -w ' [%{http_code}]\n' http://localhost:3002/health   # want [200]
   ```
   Down → `npm run build:shared && npm run prisma:generate` (if dist was wiped),
   then `cd packages/api && PORT=3002 npx tsx watch src/server.ts`.

2. **Is it a 401 or a 500?** DevTools → Network → click Retry → inspect the red
   `me`/`balance` request. 401 → auth (steps 3–4). 500 → DB/schema (step 5).
   `net::ERR`/CORS → step 6.

3. **Is `CLERK_SECRET_KEY` valid?** (a stale/revoked key in `packages/api/.env`
   has bitten us more than once). Ask Clerk — status only, never echo the key:
   ```bash
   key=$(grep '^CLERK_SECRET_KEY=' packages/api/.env | cut -d= -f2-)
   curl -s -o /dev/null -w '%{http_code}\n' -H "Authorization: Bearer $key" \
     https://api.clerk.com/v1/users?limit=1        # 200 = valid, 401 = replace it
   ```
   Rotating a key in the Clerk dashboard does **not** update `.env` — paste the
   new key in yourself and **restart the API** (`.env` is read at startup).

4. **Reveal the swallowed error.** Temporarily log `e.message` in the two
   `catch` blocks of `auth/clerk.ts`, hit Retry, read the API log. Typical:
   `Secret Key is invalid` (step 3), `token is expired` (stale session → sign
   out/in), `kid`/issuer mismatch (front/back on different Clerk instances).
   Remove the logging afterward.

5. **500s** → Postgres reachable on `localhost:5432`? Schema current
   (`npx prisma migrate deploy`)? A pending migration shows as `Unknown
   column`/type errors on business routes.

6. **CORS** → `curl -si -H "Origin: http://localhost:5173" http://localhost:3002/me | grep -i access-control`.
   No header → backend `WEB_ORIGIN` must match the web origin exactly.

**Prevention:** stop the dev servers before a clean full-suite run
(`rm -rf packages/*/dist …`) and restart the API afterward — otherwise you'll
"discover" a Failed-to-load that you caused.
