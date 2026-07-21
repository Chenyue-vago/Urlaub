# Local Dev / Demo Runbook

Exact steps to run the Urlaub app end-to-end locally: Fastify+Prisma+Postgres
API (`packages/api`) and the Vite React SPA (`packages/web`), both using
Clerk auth.

## 0. Prereqs

- Node **>= 20**. On this machine, prepend the pinned nvm node to `PATH` for
  every `node`/`npm` command:
  ```bash
  export PATH=/home/chenyue/.nvm/versions/node/v20.20.2/bin:$PATH
  ```
- Docker (for the Postgres container).
- `packages/api/.env` with `DATABASE_URL`, `TEST_DATABASE_URL`, Clerk keys,
  `WEB_ORIGIN=http://localhost:5173`, and **`PORT=3001`** (port 3000 is taken
  on this machine, so the API is run on 3001 — see step 5).
- `packages/web/.env` with `VITE_CLERK_PUBLISHABLE_KEY` and
  `VITE_API_URL=http://localhost:3001`.

These `.env` files are gitignored; copy from `.env.example` in each package
if you don't have them yet and fill in the Clerk keys.

## 1. Start Postgres

```bash
docker compose -f packages/api/docker-compose.yml up -d
```

This creates both the `urlaub` (dev) and `urlaub_test` databases in one
container (`api-postgres-1`).

## 2. Install dependencies (repo root)

```bash
npm install
```

## 3. Migrate + seed the dev database

```bash
npm --workspace packages/api run prisma:migrate
npm --workspace packages/api run prisma:seed
```

The seed is idempotent (safe to re-run any time): it upserts a 12-person
company —

- 3 admins: `founder1@vago-solutions.ai`, `founder2@vago-solutions.ai`,
  `assistant@vago-solutions.ai`
- 9 members: `dev1@vago-solutions.ai` .. `dev9@vago-solutions.ai`

— all with placeholder Clerk IDs (they cannot actually sign in), plus
sample `leave_requests` around the current date so the Team Timeline
(approved vacations in June-Aug 2026, including a half-day request) and the
Admin Approvals Queue (pending requests, including one cross-year request
split into linked segments via a shared `group_id`) have realistic content
out of the box.

## 4. Run the API (port 3001)

```bash
PORT=3001 npm --workspace packages/api run dev
```

Verify it's up: `curl localhost:3001/health` -> `{"status":"ok"}`.

## 5. Run the web app (port 5173)

In a second terminal:

```bash
npm --workspace packages/web run dev
```

Open http://localhost:5173.

## 6. First login -> become admin

Sign in with your own `@vago-solutions.ai` email via Clerk. On first login
the API's `resolveUser` auto-creates your user row with role `member`. To
see the admin views (Approvals Queue, Users/Settings/Audit panel), promote
yourself once via SQL:

```bash
docker compose -f packages/api/docker-compose.yml ps   # confirm container name, e.g. api-postgres-1
docker exec -i api-postgres-1 psql -U urlaub -d urlaub \
  -c "UPDATE users SET role='admin' WHERE email='YOUR_EMAIL@vago-solutions.ai';"
```

Refresh the app in the browser afterwards.

## 7. What to try in the demo

- **Onboarding**: set your employment start date on first login.
- **Request a vacation**: submit a request, see it land as pending and the
  reserved balance update.
- **Team timeline**: default current-month (July 2026) view shows several
  seeded approved vacations (mix of statutory/contractual, plus a half-day).
- **Admin approvals queue** (as admin): approve or reject a seeded pending
  request; note the cross-year request (Dec 2026 -> Jan 2027) shown as a
  linked group.
- **Settings** (as admin): view/edit statutory/contractual day defaults and
  carry-over deadline.
- **Audit log** (as admin): see the recorded actions after approving/
  rejecting/editing settings.

## Verification commands used to confirm this setup works

```bash
npm --workspace packages/api run build
npm --workspace packages/web run build
npm --workspace packages/api test
```
