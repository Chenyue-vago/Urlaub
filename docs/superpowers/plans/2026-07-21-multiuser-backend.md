# Multi-User Backend & Approval Workflow — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the single-user localStorage Urlaub tracker into a 12-person internal tool with a shared Fastify+Postgres backend, Clerk auth, two-tier RBAC, a reservation-style vacation approval workflow, and an all-users team timeline — runnable end-to-end **locally** before any merge/deploy.

**Architecture:** npm-workspaces monorepo: `packages/shared` (pure entitlement/holiday math, reused by both sides), `packages/api` (Fastify + Prisma + Postgres, all RBAC/approval/balance logic), `packages/web` (the existing Vite SPA, data layer swapped from localStorage to API calls). Browser → API → Postgres; the browser never touches the DB.

**Tech Stack:** Node + TypeScript + Fastify, Prisma, Postgres (local via Docker for dev), Clerk (auth), React + Vite + TanStack Query + react-router, Vitest.

**Spec:** [docs/superpowers/specs/2026-07-21-multiuser-backend-design.md](../specs/2026-07-21-multiuser-backend-design.md)

**Reuse source:** the `supabase-backup` branch already contains parameterized entitlement math (commit `84afc82`), a componentized frontend (dashboard/, admin/, auth/), and a schema shape. Read files from it with `git show supabase-backup:<path>` and adapt — do not rewrite from scratch.

**⚠️ DEMO GATE:** Milestones 0–8 are all local. **Do not touch `.github/workflows/deploy.yml`, do not merge to `main`, do not deploy** until the user has seen the local demo (end of Milestone 8) and approved. Milestone 9 (deploy) runs only after that.

**Human-provided prerequisites** (the executor cannot create these; request them when the milestone is reached):
- Docker installed locally (for local Postgres) — Milestone 2.
- A Clerk account + a dev instance publishable/secret key, with `@vago-solutions.ai` restricted to the allowlist — Milestone 3.
- (Milestone 9 only) Railway account, and the Clerk production keys.

---

## File Structure

```
package.json                      # workspace root: { "private": true, "workspaces": ["packages/*"] }
packages/
  shared/                         # NEW — pure, dependency-light math + types (no React, no DB)
    package.json                  #   name "@urlaub/shared", exports compiled TS
    src/
      types.ts                    #   VacationType, PublicHoliday, entitlement config types
      dates.ts                    #   isWeekend, parseDate, formatDateString
      holidays.ts                 #   getPublicHolidays/isPublicHoliday (moved from src/holidays.ts)
      regions.ts                  #   RegionCode, REGIONS (moved from src/regions.ts)
      entitlement.ts              #   getWorkDayDates, countWorkDays, countWorkDaysByYear,
                                  #     getYearlyEntitlement, calculateYearlyStats, carry-over —
                                  #     PARAMETERIZED by EntitlementConfig (no hardcoded 20/8/03-31)
      data/de-holidays.json       #   moved from src/data/
    test/*.test.ts                #   reuse src/utils.test.ts + supabase-backup's parameterized tests
  api/                            # NEW — Fastify backend
    package.json
    prisma/schema.prisma          #   users, leave_requests, app_settings, audit_log
    prisma/seed.ts                #   app_settings row + dev users
    src/
      server.ts                   #   Fastify app factory (buildServer) + start
      env.ts                      #   typed env loading (DATABASE_URL, CLERK_*, WEB_ORIGIN)
      db.ts                       #   PrismaClient singleton
      auth/clerk.ts               #   verify Clerk token → clerk_id/email
      auth/context.ts             #   requireAuth, requireAdmin, resolveUser (upsert users row)
      lib/errors.ts               #   AppError { code, status } + Fastify error handler
      lib/audit.ts                #   writeAuditLog(actor, action, target, meta)
      services/balance.ts         #   entitlement+used+available per bucket (uses @urlaub/shared)
      services/leave.ts           #   create (reservation txn), approve/reject/cancel (group txn)
      routes/me.ts                #   GET/PATCH /me
      routes/leave.ts             #   /leave-requests ...
      routes/balance.ts           #   GET /balance
      routes/calendar.ts          #   GET /calendar (team timeline, approved-only)
      routes/admin.ts             #   /admin/users, /settings, /admin/audit-log
    test/*.test.ts                #   unit (balance/leave) + integration (routes) via test DB
    docker-compose.yml            #   local Postgres for dev/test
  web/                            # MOVED from repo root (git mv) — existing Vite SPA
    index.html, vite.config.ts, tsconfig*.json, public/, scripts/
    src/
      main.tsx, App.tsx           #   App.tsx becomes a thin router shell
      lib/api.ts                  #   NEW fetch wrapper (adds Clerk token, parses {error,code})
      lib/clerk.tsx               #   NEW ClerkProvider + auth gate
      queryClient.ts              #   NEW TanStack Query client
      services/{me,leave,balance,calendar,admin}.ts   #   NEW — call the API
      hooks/{useMe,useLeave,useBalance,useCalendar,useAdmin}.ts  #   NEW — TanStack Query
      components/
        auth/                     #   Clerk sign-in gate
        dashboard/                #   reuse from supabase-backup (StatsCards, RecordList, etc.)
        timeline/TeamTimeline.tsx #   NEW — the overview
        admin/                    #   reuse + ApprovalsQueue (NEW)
      i18n.ts, index.css, regions.ts(re-export shared)
```

---

## Milestone 0 — Monorepo scaffold

### Task 0.1: Create workspace root & move frontend into `packages/web`

**Files:** Create `package.json` (root); move all current frontend files into `packages/web/`.

- [ ] **Step 1:** Move the frontend (preserve history):
```bash
mkdir -p packages/web
git mv src index.html vite.config.ts tsconfig.json tsconfig.node.json public scripts packages/web/
git mv package.json packages/web/package.json
git mv package-lock.json packages/web/package-lock.json 2>/dev/null || true
```
- [ ] **Step 2:** Create root `package.json`:
```json
{
  "name": "urlaub-monorepo",
  "private": true,
  "workspaces": ["packages/*"],
  "scripts": {
    "dev:web": "npm --workspace packages/web run dev",
    "dev:api": "npm --workspace packages/api run dev",
    "test": "npm --workspaces --if-present run test",
    "build": "npm --workspaces --if-present run build"
  }
}
```
- [ ] **Step 3:** Fix `packages/web/vite.config.ts` `base` note — leave `/Urlaub/` for build (Pages path unchanged); dev stays `/`.
- [ ] **Step 4:** Verify web still builds from its new home:
```bash
npm install
npm --workspace packages/web run build
```
Expected: build succeeds, `packages/web/dist` produced.
- [ ] **Step 5: Commit** — `git commit -m "chore: convert to npm workspaces, move frontend to packages/web"`

---

## Milestone 1 — Shared math package (`packages/shared`)

Reuse the **parameterized** math from `supabase-backup` (commit `84afc82` made entitlement config injectable). Extract the pure functions out of `packages/web/src/utils.ts` — leave the localStorage functions (`saveToStorage`, `loadFromStorage`, `exportAllData`, `importAllData`, `ALL_STORAGE_KEYS`) behind in web (they are removed later).

### Task 1.1: Scaffold `@urlaub/shared`

**Files:** Create `packages/shared/package.json`, `packages/shared/tsconfig.json`.

- [ ] **Step 1:** `packages/shared/package.json`:
```json
{
  "name": "@urlaub/shared",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": { "build": "tsc -p tsconfig.json", "test": "vitest run" },
  "dependencies": { "date-holidays-parser": "^3.4.7" },
  "devDependencies": { "typescript": "^5.3.3", "vitest": "^4.1.8" }
}
```
- [ ] **Step 2:** Add `tsconfig.json` (NodeNext, `outDir: dist`, `declaration: true`), then `git commit -m "chore: scaffold @urlaub/shared"`.

### Task 1.2: Define `EntitlementConfig` type + move dates/regions/holidays

**Files:** Create `packages/shared/src/types.ts`, `dates.ts`, `regions.ts`, `holidays.ts`, `data/de-holidays.json`, `index.ts`.

- [ ] **Step 1:** `types.ts` — copy `VacationType`, `PublicHoliday` from `packages/web/src/types.ts`, and add:
```ts
export interface EntitlementConfig {
  statutoryDays: number;    // default 20
  contractualDays: number;  // default 8
  carryOverDeadline: string; // "MM-DD", default "03-31"
}
export const DEFAULT_ENTITLEMENT: EntitlementConfig = {
  statutoryDays: 20, contractualDays: 8, carryOverDeadline: "03-31",
};
```
- [ ] **Step 2:** `git mv packages/web/src/regions.ts packages/shared/src/regions.ts`; `git mv packages/web/src/holidays.ts packages/shared/src/holidays.ts`; `git mv packages/web/src/data/de-holidays.json packages/shared/src/data/`. Move `isWeekend/parseDate/formatDateString` into `dates.ts`.
- [ ] **Step 3:** `index.ts` re-exports everything. `git commit -m "feat(shared): types, dates, regions, holidays"`.

### Task 1.3: Port entitlement math (TDD, parameterized)

**Files:** Create `packages/shared/src/entitlement.ts`, `packages/shared/test/entitlement.test.ts`.

- [ ] **Step 1: Write failing tests** — copy `packages/web/src/utils.test.ts` cases and the parameterized cases from `git show supabase-backup:src/utils.test.ts`. Key assertions:
```ts
import { calculateYearlyStats, getYearlyEntitlement, countWorkDaysByYear } from "../src/entitlement";
import { DEFAULT_ENTITLEMENT } from "../src/types";

test("cross-year split returns one segment per year", () => {
  const segs = countWorkDaysByYear("2025-12-29", "2026-01-03", "BW");
  expect(segs.map(s => s.year)).toEqual([2025, 2026]);
});

test("entitlement is pro-rated by employment start month", () => {
  const e = getYearlyEntitlement(2026, DEFAULT_ENTITLEMENT, "2026-07-01");
  expect(e.statutoryTotal).toBe(Math.ceil(20 * 6 / 12)); // 10
});

test("config overrides hardcoded defaults", () => {
  const e = getYearlyEntitlement(2026, { statutoryDays: 30, contractualDays: 0, carryOverDeadline: "03-31" });
  expect(e.statutoryTotal).toBe(30);
});
```
- [ ] **Step 2: Run, verify fail:** `npm --workspace packages/shared test` → FAIL (module not found).
- [ ] **Step 3: Implement** — copy the functions from `packages/web/src/utils.ts` (lines 32–240: `isWeekend`→`calculateCarryOver`) into `entitlement.ts`, replacing the module-level `STATUTORY_VACATION_DAYS`/`CONTRACTUAL_VACATION_DAYS` constants and the literal `"${year}-03-31"` deadline with an `EntitlementConfig` parameter threaded through `getYearlyEntitlement` and `calculateYearlyStats`. (The `supabase-backup` version already did this — prefer `git show supabase-backup:src/utils.ts` as the reference implementation.)
- [ ] **Step 4: Run, verify pass:** `npm --workspace packages/shared test` → PASS.
- [ ] **Step 5:** `npm --workspace packages/shared run build` → `dist/` produced. Commit `feat(shared): parameterized entitlement math with tests`.

---

## Milestone 2 — API foundation (Fastify + Prisma + local Postgres)

### Task 2.1: Scaffold `packages/api` + local Postgres

**Files:** Create `packages/api/package.json`, `tsconfig.json`, `docker-compose.yml`, `.env.example`.

- [ ] **Step 1:** `docker-compose.yml` with a `postgres:16` service on 5432, db `urlaub`, and a second db `urlaub_test`.
- [ ] **Step 2:** `package.json` deps: `fastify`, `@fastify/cors`, `@prisma/client`, `@urlaub/shared` (workspace `*`), `@clerk/backend`, `zod`; dev: `prisma`, `tsx`, `typescript`, `vitest`. Scripts: `dev` (`tsx watch src/server.ts`), `test`, `prisma:migrate`, `prisma:seed`.
- [ ] **Step 3:** `.env.example` with `DATABASE_URL`, `TEST_DATABASE_URL`, `CLERK_SECRET_KEY`, `CLERK_PUBLISHABLE_KEY`, `WEB_ORIGIN=http://localhost:5173`.
- [ ] **Step 4:** `docker compose up -d` → Postgres reachable. Commit `chore: scaffold api package + local postgres`.

### Task 2.2: Prisma schema + first migration

**Files:** Create `packages/api/prisma/schema.prisma`.

- [ ] **Step 1:** Model the four tables per spec §3 (enums `Role`, `LeaveType`, `LeaveStatus`; `users` with `clerkId @unique`, `email @unique`; `leave_requests` with `groupId`, `year`, `workDays Decimal`, indices `@@index([userId, year])`, `@@index([status, startDate])`, `@@index([groupId])`; `app_settings` single row; `audit_log`).
- [ ] **Step 2:** `npx prisma migrate dev --name init` → migration applied to local db.
- [ ] **Step 3:** `prisma/seed.ts` inserts the `app_settings` row (id=1, defaults) and, for dev, 3 admin + 2 member users with fixed `clerkId` placeholders. Wire `prisma db seed`.
- [ ] **Step 4:** Commit `feat(api): prisma schema + init migration + seed`.

### Task 2.3: Server factory, env, db singleton, error handler

**Files:** Create `src/env.ts`, `src/db.ts`, `src/lib/errors.ts`, `src/server.ts`.

- [ ] **Step 1: Write failing test** `test/server.test.ts`:
```ts
import { buildServer } from "../src/server";
test("GET /health returns ok", async () => {
  const app = buildServer();
  const res = await app.inject({ method: "GET", url: "/health" });
  expect(res.statusCode).toBe(200);
  expect(res.json()).toEqual({ status: "ok" });
});
```
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `buildServer()` returning a Fastify instance with `@fastify/cors` (origin = `WEB_ORIGIN`), the `AppError` handler (maps `{code,status}`→JSON `{error,code}`), and a `/health` route. `errors.ts` defines `AppError` + helpers `forbidden()`, `notFound()`, `badRequest(code)`, `conflict(code)`.
- [ ] **Step 4: Run, verify pass.**
- [ ] **Step 5:** Commit `feat(api): server factory, cors, error handler, health`.

---

## Milestone 3 — Auth (Clerk) + RBAC middleware

*Prerequisite: request Clerk dev keys from the user here.* For tests, the Clerk verifier is injected so it can be faked.

### Task 3.1: Clerk token verification (injectable)

**Files:** Create `src/auth/clerk.ts`.

- [ ] **Step 1: Write failing test** `test/auth.test.ts` — a fake verifier returns `{ clerkId, email }`; assert `resolveUser` upserts a `users` row and returns it; assert unknown email outside `@vago-solutions.ai` is rejected with `AppError("email_domain_not_allowed", 403)`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `verifyToken(token)` using `@clerk/backend` `verifyToken`; export an interface so tests inject a fake. Domain check on email.
- [ ] **Step 4: Run, verify pass.** Commit `feat(api): clerk token verification`.

### Task 3.2: `resolveUser` upsert + `requireAuth`/`requireAdmin`

**Files:** Create `src/auth/context.ts`.

- [ ] **Step 1: Write failing tests** (integration, test DB): first request for a new allowlisted email upserts a `member` row (never admin); `is_active=false` → `AppError("account_deactivated",403)`; `requireAdmin` rejects a member with `AppError("forbidden",403)`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** a Fastify `preHandler` that: reads `Authorization: Bearer`, verifies, upserts by `clerkId` (default role `member`), attaches `req.user`, rejects inactive. `requireAdmin` checks `req.user.role === 'admin'`.
- [ ] **Step 4: Run, verify pass.** Commit `feat(api): resolveUser upsert + rbac preHandlers`.

---

## Milestone 4 — Core: balance + leave request lifecycle (the heart)

### Task 4.1: Balance service (TDD)

**Files:** Create `src/services/balance.ts`, `test/balance.test.ts`.

- [ ] **Step 1: Write failing tests** — seed a user + settings + some `approved`/`pending`/`rejected` rows; assert per-bucket `available = entitlement + carryOver − sum(work_days where status in (pending,approved))`; assert `rejected`/`cancelled` do not count. Use `@urlaub/shared` for entitlement.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `getBalance(userId, year)`: load settings→`EntitlementConfig`, load user `employment_start_date`, compute prior-year carry-over via shared `calculateCarryOver`, subtract `used` (pending+approved) per bucket.
- [ ] **Step 4: Run, verify pass.** Commit `feat(api): balance service`.

### Task 4.2: Create leave request — reservation transaction, cross-year group (TDD)

**Files:** Create `src/services/leave.ts`, `test/leave-create.test.ts`.

- [ ] **Step 1: Write failing tests:**
  - member request within balance → creates `pending` row(s), reserves balance.
  - request exceeding available → `AppError("insufficient_balance",409)`, nothing created.
  - **cross-year** request (Dec→Jan) → creates **2 rows sharing `groupId`**, one per year, each `year`/`work_days` correct.
  - **concurrency:** two parallel creates that together exceed balance → exactly one succeeds (run inside `$transaction` with serializable isolation; assert final used ≤ entitlement).
  - admin create for another user → rows created `approved`, `decided_by=admin`.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `createLeave({actor, targetUserId, start, end, type, reason})`:
  - `countWorkDaysByYear` (shared) → segments; generate one `groupId`.
  - `prisma.$transaction(async tx => { for each segment: check getBalance within tx; if any short → throw insufficient_balance; insert row })` with `isolationLevel: Serializable`.
  - status: member→`pending`; admin→`approved` (+`decidedBy`, `decidedAt`). Write audit log.
- [ ] **Step 4: Run, verify pass.** Commit `feat(api): create leave with reservation + cross-year group`.

### Task 4.3: Approve / reject / cancel — whole-group transitions (TDD)

**Files:** Modify `src/services/leave.ts`; create `test/leave-transitions.test.ts`.

- [ ] **Step 1: Write failing tests:** approve sets all rows of the `groupId` to `approved` with `decidedBy`; reject → `rejected` (frees balance) with `decisionNote`; member cancel of own `pending` → `cancelled`; member cannot approve (`forbidden`); cannot approve an already-decided group (`AppError("invalid_transition",409)`); last-admin guard is unrelated (users milestone). Each transition writes an audit row.
- [ ] **Step 2: Run, verify fail.**
- [ ] **Step 3: Implement** `decideLeave(actor, groupId, action, note?)` and `cancelLeave(actor, groupId)` — load group rows in a txn, validate current status + permission, update all rows, audit.
- [ ] **Step 4: Run, verify pass.** Commit `feat(api): approve/reject/cancel group transitions`.

---

## Milestone 5 — Routes (thin handlers over services)

Each route task = write route + integration test asserting status + permission. Follow this **pattern** for every endpoint (write test → fail → implement handler calling the service with `req.user` → pass → commit).

### Task 5.1: `/me` routes
- [ ] `GET /me` (returns `req.user`), `PATCH /me` (region/displayName/employmentStartDate via `zod`). Test + commit.

### Task 5.2: `/leave-requests` routes
- [ ] `GET` (member→own; admin→`userId` filter), `POST` (createLeave), `GET /:id`, `POST /:id/cancel|approve|reject`. One integration test per verb asserting the permission matrix. Commit.

### Task 5.3: `GET /balance`
- [ ] member→self, admin→any `userId`. Test + commit.

### Task 5.4: `GET /calendar` (team timeline)
- [ ] Returns **approved-only** rows in `[from,to]` for **all** users; response shape exposes only `{ userId, displayName, startDate, endDate, type }` — **never** `reason`/`decisionNote`. Test asserts a member can call it AND that `reason` is absent. Commit.

### Task 5.5: Admin routes
- [ ] `GET /admin/users` (+usage), `POST /admin/users/invite` (Clerk invite + pre-create row), `PATCH /admin/users/:id` (role/isActive) with **last-admin guard** (`AppError("last_admin",409)` on demote/deactivate of the only admin), `GET /settings`, `PATCH /settings`, `GET /admin/audit-log`. Test each; commit per group.

### Task 5.6: Register routes + manual smoke
- [ ] Register all routers in `server.ts`. Run `npm --workspace packages/api run dev`, `curl localhost:3000/health`. Commit `feat(api): register all routes`.

---

## Milestone 6 — Frontend data layer + auth gate

### Task 6.1: Clerk provider + API client
**Files:** Create `packages/web/src/lib/clerk.tsx`, `lib/api.ts`, `queryClient.ts`; add deps `@clerk/clerk-react`, `@tanstack/react-query`, `react-router-dom`.
- [ ] `ClerkProvider` wrapping the app; `<SignedIn>/<SignedOut>` gate. `api.ts` = `fetch` wrapper injecting the Clerk session token and throwing typed errors from `{error,code}`. Commit.

### Task 6.2: Services + hooks
**Files:** Create `services/{me,leave,balance,calendar,admin}.ts` + `hooks/*`.
- [ ] Thin functions calling `api.ts`; TanStack Query hooks with optimistic updates on create/cancel. Reuse shape from `git show supabase-backup:src/services/*` but point at REST instead of supabase-js. Commit per service.

### Task 6.3: Remove localStorage layer
- [ ] Delete `saveToStorage/loadFromStorage/export/import` usage from web; `regions.ts`/`holidays.ts` in web become re-exports of `@urlaub/shared`. Commit.

---

## Milestone 7 — Frontend views

### Task 7.1: Router shell + My Dashboard
- [ ] `App.tsx` → react-router with routes `/` (dashboard), `/team`, `/admin` (admin-gated). Reuse `dashboard/` components from `supabase-backup` (`StatsCards`, `RecordList`, `RecordModal`, `YearNav`, `WelcomeModal`, `SettingsModal`), wired to hooks. Request-vacation modal calls `POST /leave-requests`; shows status badges. Commit.

### Task 7.2: Team Timeline
**Files:** Create `components/timeline/TeamTimeline.tsx`.
- [ ] Rows = users, columns = days in the selected range; approved leave drawn as colored bars by `type`; legend. Data from `useCalendar`. All users can view. Commit.

### Task 7.3: Admin panel + Approvals queue
- [ ] Reuse `admin/UserTable`, `SettingsCard`, `UserRecordsModal` from `supabase-backup`; add `ApprovalsQueue` listing `pending` groups with approve/reject (+note). Audit-log view. Commit.

### Task 7.4: i18n error toasts
- [ ] Map API `code`s to i18n strings (en/zh) surfaced via the existing Toast. Cover `insufficient_balance`, `forbidden`, `account_deactivated`, `last_admin`, validation. Commit.

---

## Milestone 8 — Local end-to-end demo  ← **DEMO GATE**

### Task 8.1: One-command local run
**Files:** Create `packages/api/README.md`, root `README.md` dev section.
- [ ] Document/verify: `docker compose up -d` (Postgres) → `npm --workspace packages/api run prisma:migrate && prisma:seed` → `npm run dev:api` → `npm run dev:web`, with `.env` (Clerk dev keys, `VITE_API_URL=http://localhost:3000`, `VITE_CLERK_PUBLISHABLE_KEY`).
- [ ] **Step: full manual smoke** — sign in as a seeded member, request vacation (see it pending + balance reserved), sign in as admin, approve it, confirm it appears on the team timeline; try an over-balance request (see the error toast); reject flow; last-admin guard.
- [ ] Commit `docs: local dev + demo runbook`.

### Task 8.2: 🚦 STOP — show the user the local demo
- [ ] **Hand off to the user for the demo.** Do not proceed to Milestone 9 until they approve. Collect any change requests and loop back.

---

## Milestone 9 — Deployment (ONLY after demo approval)

*Prerequisite: request Railway account + Clerk production keys.*

### Task 9.1: Deploy API + Postgres on Railway
- [ ] Create Railway project, provision Postgres, deploy `packages/api`, run migrations + seed, set env (DB URL, Clerk prod secret, `WEB_ORIGIN` = Pages URL). Verify `/health` over HTTPS.

### Task 9.2: Point frontend at the API + fix Pages build
- [ ] Set `VITE_API_URL` (Railway URL) + `VITE_CLERK_PUBLISHABLE_KEY` as GitHub Actions build env; update `.github/workflows/deploy.yml` for the `packages/web` path; set API CORS `WEB_ORIGIN` to the Pages origin.
- [ ] Add the PR-triggered CI workflow (see [CLAUDE.md](../../../CLAUDE.md) TODO): run tests + build on `pull_request`.

### Task 9.3: Merge to main + verify live
- [ ] Open PR `feature/multiuser-backend` → `main`, pass CI/review, merge; confirm Pages redeploys and the live app talks to the Railway API.

---

## Notes for the executor
- **TDD**: every service/route task writes the failing test first. Integration tests use `TEST_DATABASE_URL` (the `urlaub_test` db), truncated between tests.
- **DRY**: the entitlement/holiday math lives ONLY in `@urlaub/shared`; never re-implement it in api or web.
- **Frequent commits**: one commit per task step-group as shown.
- **Reuse**: prefer adapting `supabase-backup` files (`git show supabase-backup:<path>`) over greenfield code for the frontend components, services shape, and parameterized math.
- **No AI-attribution trailer** in commit messages (project rule).
- **Do not** modify `deploy.yml` / merge / deploy before Milestone 8's demo approval.
