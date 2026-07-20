# Urlaub: Multi-User Backend & Approval Workflow — Design

**Date:** 2026-07-21
**Status:** Draft (pending review)
**Branch:** `feature/multiuser-backend`

## Goal

Turn the single-user, localStorage-based Urlaub vacation tracker into a real
internal tool for a 12-person company (vago-solutions). Add a shared backend, user
accounts, a two-tier role model, a request/approval workflow for vacations, and a
team-wide overview of who is on vacation. All existing entitlement math (statutory +
contractual days, carry-over, cross-year splits, German public holidays, i18n) keeps
working, now backed by a server and shared across all users.

This is a fresh start: no migration of existing localStorage or old Supabase data.

## Context

- **Company:** 12 people — 2 founders, 1 assistant, 9 developers.
- **Roles observed:** the assistant records and approves everyone's vacations; the two
  founders share full management rights; the 9 developers request vacations.
- A prior attempt (`supabase-backup` branch) migrated the app to Supabase (direct
  client → DB, RLS as the security boundary, two-tier user/admin, no approval flow).
  Its Supabase project was auto-paused on the free tier, breaking the deployed app. We
  reverted `main` to the pre-Supabase localStorage version. This design reuses the
  prior branch's **component structure, entitlement math, and schema shape**, but
  changes the architecture to a self-built API (business logic and permissions enforced
  server-side, not via RLS).

## Decisions Made

| Decision | Choice |
|---|---|
| Architecture | Frontend SPA → self-built API → managed Postgres. Browser never touches the DB directly. All RBAC, approval, and balance logic enforced in the API. |
| Roles | Two tiers: `admin` (2 founders + 1 assistant) and `member` (9 developers). No teams / middle-management layer. |
| Approval workflow | Reservation-style. A submitted request goes to `pending` and immediately reserves balance; approve confirms it, reject/cancel frees it. |
| Auth | Clerk (hosted). Email + password with `@vago-solutions.ai` restriction and password reset first; Microsoft/Entra SSO as a later config toggle. Identity lives in Clerk; role/profile/active-status live in our DB. |
| Frontend host | Vite SPA on GitHub Pages now; trivially movable to Vercel later. Frontend stays portable. |
| Backend host | API + Postgres on Railway (single platform). |
| API stack | Node + TypeScript + Fastify. |
| ORM | Prisma. |
| Data layer (FE) | Services call the API; TanStack Query for caching/optimistic updates. |
| Entitlement math | Extracted into a shared package used by both API (authoritative balance) and frontend (instant preview). |
| Existing data | Fresh start — no migration. |
| Audit log | Included in v1. |
| Half-days | Supported (`work_days` is numeric, allows 0.5). |
| Buckets | Statutory and contractual vacation tracked as separate buckets (existing logic). |

## 1. Architecture

```
React SPA (Vite)      ── HTTPS/JSON, session token ──►   API (Fastify)   ── SQL ──►  Postgres
GitHub Pages          ◄──────────────────────────────   (auth/RBAC/                (Railway)
(later: Vercel)                                           approval/balance)
```

- The **frontend** is a static SPA. It authenticates via Clerk, then calls the API with
  the Clerk session token on every request.
- The **API** is the only component that talks to the database. It validates the token,
  resolves the current user + role from our `users` table, enforces permissions, runs
  business logic (approval state transitions, balance reservation in a transaction), and
  writes an audit trail.
- The **database** is managed Postgres.

Frontend and backend are decoupled and independently deployable/movable.

## 2. Tech Stack

| Layer | Choice | Rationale |
|---|---|---|
| API language/framework | Node + TypeScript + Fastify | Same language as the frontend; lets us reuse the tested entitlement math; Fastify is lean with little boilerplate — right-sized for 12 users. |
| ORM | Prisma | Best-documented, most beginner-friendly ORM: schema file, automatic migrations, full TS types. Team is new to backend. |
| DB + API host | Railway | One platform, one dashboard, private networking between API and DB, low cost. Minimizes ops overhead. |
| Auth | Clerk | Handles the fiddly, security-sensitive parts (password storage, reset emails, MFA, OIDC) out of the box; Microsoft SSO is a later toggle; free at this scale. |
| FE data layer | TanStack Query | Caching + optimistic updates so the UI feels as instant as localStorage did. |
| Routing | react-router | Four views (login, my dashboard, team timeline, admin). |

## 3. Data Model

Four tables. Fresh schema via Prisma migrations.

### 3.1 `users`

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| email | text unique | Must be `@vago-solutions.ai` |
| display_name | text | |
| role | enum(`admin`,`member`) | Two-tier role |
| region | text | German federal state code (e.g. `BW`), for public holidays |
| employment_start_date | date? | Null until onboarding; used to pro-rate entitlement |
| is_active | bool | Inactive users are rejected at the API even if Clerk auth succeeds |
| created_at | timestamptz | |

Clerk holds the credential/identity; this row holds app-specific profile + role. On
first authenticated request, the API upserts a `users` row keyed by email / Clerk ID.

### 3.2 `leave_requests` (core new table)

| Field | Type | Notes |
|---|---|---|
| id | uuid PK | |
| user_id | uuid FK→users | Whose vacation |
| start_date / end_date | date | |
| work_days | numeric | Working days excluding weekends + public holidays; supports 0.5 |
| type | enum(`statutory`,`contractual`) | Two buckets |
| year | int | Entitlement year the request counts against |
| is_carry_over | bool | Uses previous year's carry-over |
| status | enum(`pending`,`approved`,`rejected`,`cancelled`) | Approval state |
| reason | text | Employee's note (hidden from peers) |
| decided_by | uuid? FK→users | Approving/rejecting admin |
| decided_at | timestamptz? | |
| decision_note | text? | Admin's note (e.g. rejection reason) |
| created_at / updated_at | timestamptz | |

Admin "record on behalf of" = create a row with `status='approved'`, `decided_by = admin`.

Index on `(user_id, year)` and `(status, start_date)` for the team timeline query.

### 3.3 `app_settings` (single global row)

`id (=1)`, `statutory_days` (default 20), `contractual_days` (default 8),
`carry_over_deadline` (MM-DD, default `03-31`), `updated_at`. Admin-editable only.

### 3.4 `audit_log`

`id`, `actor_id` (FK→users), `action` (e.g. `approve_request`, `reject_request`,
`change_role`, `deactivate_user`, `update_settings`), `target_type`, `target_id`,
`metadata` (jsonb), `created_at`.

## 4. Approval State Machine

```
                    member submits
                         │
                         ▼
  member withdraws ◄── pending (reserves balance)
  (→ cancelled)          │
              admin approve │ admin reject
                    ┌──────┴──────┐
                    ▼             ▼
                approved       rejected
              (confirmed,      (frees balance)
               still counts)
                    │
   admin/member cancels │
   future vacation      ▼
                   cancelled (frees balance)
```

- `pending` reserves balance to prevent overbooking; the member can withdraw it.
- `approved` is the final commit; still counts toward used days.
- `rejected` / `cancelled` do not count and free the balance.

## 5. Balance Reservation (core logic)

Per user, per year, per bucket (statutory / contractual computed separately):

```
entitlement = app_settings days
            × in-employment fraction (from employment_start_date)   ← shared math package
            + previous-year carry-over (valid before carry_over_deadline)

used        = sum of work_days where status ∈ {pending, approved} for that year
available   = entitlement − used
```

Both `pending` and `approved` subtract from balance (that is the reservation).
`rejected` / `cancelled` do not.

**Concurrency:** creating a request runs `check available ≥ work_days` and the insert
inside a single database transaction (row/serializable locking), so two near-
simultaneous requests that together exceed the balance cannot both succeed. This
atomic check is a key reason for the API-in-front (approach B) over client-direct + RLS.

## 6. Authentication (Clerk)

- Frontend uses Clerk's prebuilt components for login/signup/password-reset.
- Sign-ups restricted to the `@vago-solutions.ai` domain (Clerk allowlist).
- Every API request carries the Clerk session token. API middleware validates it,
  resolves/creates the matching `users` row, and loads `role` + `is_active`.
- Role, active-status, region, and employment date are managed in our app by admins —
  Clerk only proves identity.
- `is_active = false` → API rejects the request regardless of valid Clerk auth.
- **Later:** enabling Microsoft/Entra SSO is a Clerk configuration change; no app rewrite.
- **Fallback considered and rejected:** self-built auth (Lucia + argon2 + email sender).
  Rejected because it puts password-reset and SSO plumbing on a team new to backend.

## 7. API Surface

Permission is enforced by three middleware layers: `requireAuth`, `requireAdmin`, and
per-resource ownership checks.

**Profile (self)**
- `GET /me` — my profile (creates the row on first call)
- `PATCH /me` — update own region / display_name / employment_start_date

**Leave requests**
- `GET /leave-requests?year=&userId=` — member: own only; admin: any/all
- `POST /leave-requests` — member: creates `pending` for self with transactional balance
  check; admin: creates for anyone, auto-`approved`
- `GET /leave-requests/:id` — own or admin
- `POST /leave-requests/:id/cancel` — member cancels own pending/future; admin any
- `POST /leave-requests/:id/approve` — admin only
- `POST /leave-requests/:id/reject` — admin only (with `decision_note`)

**Balance**
- `GET /balance?year=&userId=` — entitlement/used/available per bucket; member self, admin any

**Team timeline (all authenticated users)**
- `GET /calendar?from=&to=` — all users' **approved** leave in range. Peer-visible fields
  only: display_name, dates, type, status. `reason` / `decision_note` are never exposed
  to peers.

**Admin — users**
- `GET /admin/users` — user list + usage summary
- `POST /admin/users/invite` — invite a user (Clerk invite + pre-create `users` row)
- `PATCH /admin/users/:id` — change role / active status.
  Guard: the last remaining admin cannot be demoted or deactivated.

**Admin — settings & audit**
- `GET /settings` (all authenticated) · `PATCH /settings` (admin only)
- `GET /admin/audit-log` — admin only, paginated

## 8. Team Timeline (overview feature)

- **Layout:** team timeline — one row per person, dates across the top, approved
  vacations drawn as colored bars (colored by leave type).
- **Visibility:** all 12 users.
- **Shown:** approved leave only (pending is not shown, to keep the overview definitive).
- **Privacy:** peers see name + dates + type + status; notes/reasons are hidden.
- Read-only aggregation over `leave_requests`; no new tables. This is the single
  intentional exception to "members see only their own data."

## 9. Frontend

Reuse the componentized structure from `supabase-backup` (dashboard/, admin/, auth/,
hooks/, services/), swapping the data layer from supabase-js to API calls.

**Views (react-router):**
1. **Login** — Clerk components; auth gate.
2. **My dashboard** (member default) — my balance per bucket, my requests with status
   badges, "request vacation", onboarding welcome modal (employment start / region).
3. **Team timeline** (all) — the overview feature.
4. **Admin panel** (admin only) — approvals queue (approve/reject), users table + usage,
   per-user records, global settings, audit log.

**Data layer:** `services/*.ts` call the API (fetch); `hooks/*` wrap them with TanStack
Query. Balance/working-day previews call the shared math package (same algorithm as the
server).

**Reused components:** StatsCards, RecordList, RecordModal, YearNav, WelcomeModal,
SettingsModal, admin/UserTable. **New:** TeamTimeline, ApprovalsQueue, status badges.

## 10. Shared Entitlement-Math Package

The pure functions in `src/utils.ts` (entitlement, carry-over, cross-year split,
pro-rating) and `src/holidays.ts` (working-day / public-holiday computation) are
extracted into a package imported by both the API and the frontend, so the server's
authoritative balance and the frontend's preview always agree.

## 11. Error Handling

- API returns `{ error, code }` with appropriate HTTP status.
- Frontend surfaces errors through the existing Toast component, translated via the
  existing i18n system (English / Chinese) — no hardcoded strings.
- Distinct, translated messages for: balance-exceeded, permission-denied, validation
  failure, deactivated-account.
- TanStack Query: optimistic updates roll back on failure; loading skeletons on fetch.

## 12. Testing

- **Shared math package:** unit tests (vitest) — reuse the existing passing tests.
- **API:**
  - Unit tests for balance reservation + approval state transitions, explicitly covering
    concurrent over-booking being blocked by the transaction.
  - Endpoint integration tests against a test Postgres, asserting: members cannot read
    others (except the team timeline) and cannot approve; admins can; the last-admin
    guard; deactivated accounts are rejected.
- **Frontend:** component tests for the request → status flow; service tests with a
  mocked API.

## 13. Rollout / Deployment

- Backend: deploy the Fastify API + Postgres on Railway; configure Clerk keys and DB URL
  as environment variables/secrets.
- Frontend: keep on GitHub Pages; add the API base URL and Clerk publishable key as build
  env vars. CORS on the API allows the Pages origin.
- Later (optional): move the frontend to Vercel with no rewrite; backend unaffected.
- Seed: create the `app_settings` row; invite the 12 users; designate the 3 admins.

## Out of Scope

- Migration of existing localStorage / old Supabase data (fresh start).
- Teams / middle-management layer.
- Showing pending requests on the team timeline.
- Email/Slack notifications on request/approval (possible future addition).
- Per-user custom entitlements (global settings only, as today).
- Multi-tenant / multi-company support.
