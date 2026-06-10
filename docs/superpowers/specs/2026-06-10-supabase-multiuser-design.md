# Urlaub: Supabase Multi-User Migration — Design

**Date:** 2026-06-10
**Status:** Approved
**Branch:** `database_integration`

## Goal

Migrate the Urlaub vacation tracker from a single-user localStorage app to a multi-user, production-grade app backed by Supabase Postgres. Add user accounts and an admin role. All existing functionality (entitlement calculation, carry-over logic, cross-year splits, public holidays, i18n) keeps working, now scoped per user.

## Decisions Made

| Decision | Choice |
|---|---|
| Architecture | Direct client → Supabase via supabase-js; Row Level Security (RLS) is the security boundary. No backend server. Stays deployable on GitHub Pages. |
| Auth | Email + password via Supabase Auth |
| Admin powers | View all users + stats, manage users (promote/demote, activate/deactivate), edit any user's vacation records, configure global defaults |
| Entitlement | Global for everyone, admin-configurable (default 20 statutory + 8 contractual) |
| Existing localStorage data | Fresh start — no migration |
| Signup / admin bootstrap | Open signup. First registered user automatically becomes admin. Admins can promote other users to admin. |
| Code approach | Proper data layer: services + TanStack Query + auth context + split App.tsx into focused components |

## 1. Database Schema

Three tables in Supabase Postgres, created via versioned SQL migrations in `supabase/migrations/`.

```sql
-- profiles: 1 row per auth user, auto-created by trigger on auth.users insert
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  region text not null default 'BY',          -- German federal state code
  employment_start_date date,                  -- null until welcome modal completed
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

-- vacation_records: per-user vacation entries
create table vacation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  start_date date not null,
  end_date date not null,
  work_days numeric not null,
  description text not null default '',
  type text not null check (type in ('statutory', 'contractual')),
  is_carry_over boolean not null default false,
  year int not null,
  created_at timestamptz not null default now()
);

-- app_settings: single global config row, admin-editable
create table app_settings (
  id int primary key check (id = 1),
  statutory_days int not null default 20,
  contractual_days int not null default 8,
  carry_over_deadline text not null default '03-31',  -- MM-DD
  updated_at timestamptz not null default now()
);
```

### Triggers

- **Profile auto-creation:** trigger on `auth.users` insert creates the matching `profiles` row (copies email).
- **First user = admin:** inside the same trigger, if `profiles` is empty, set `role = 'admin'`.
- **Settings seed:** migration inserts the single `app_settings` row.

### RLS Policies

All three tables have RLS enabled. Admin checks go through a `security definer` function to avoid RLS recursion:

```sql
create function is_admin() returns boolean
language sql security definer stable
as $$ select exists (select 1 from profiles where id = auth.uid() and role = 'admin') $$;
```

| Table | Policy |
|---|---|
| `profiles` | Users select/update own row. Users cannot change own `role` or `is_active` (enforced via column check in update policy / trigger). Admins select/update all rows. |
| `vacation_records` | Users select/insert/update/delete rows where `user_id = auth.uid()`. Admins all rows. |
| `app_settings` | All authenticated users select. Only admins update. No insert/delete (single row). |

## 2. Auth Flow

- No session → Login/Signup screen (email + password). Supabase handles password hashing, sessions, refresh tokens, password-reset emails.
- `AuthProvider` React context exposes `session`, `profile`, `isAdmin`, `signIn`, `signUp`, `signOut`.
- After login, profile is fetched; if `is_active = false`, the user is signed out with an "account deactivated" message.
- Welcome modal (first visit, employment start date missing) now writes to `profiles.employment_start_date` instead of localStorage.

## 3. Data Layer

```
src/lib/supabase.ts          — typed supabase-js client (Database types generated or hand-written)
src/services/vacations.ts    — list/create/delete vacation records (RLS scopes to user)
src/services/profile.ts      — get/update own profile (region, employment start, display name)
src/services/settings.ts     — get global settings; admin update
src/services/admin.ts        — list users with usage stats, promote/demote, activate/deactivate,
                               CRUD any user's records
src/hooks/useVacations.ts    — TanStack Query hooks wrapping services
src/hooks/useProfile.ts
src/hooks/useSettings.ts
src/hooks/useAdmin.ts
```

- TanStack Query provides caching and optimistic updates on create/delete so the UI feels as instant as localStorage did.
- All entitlement math in `utils.ts` (stats, carry-over, cross-year split, pro-rating) is unchanged logic — inputs now come from DB queries instead of localStorage. Hardcoded `STATUTORY_VACATION_DAYS` / `CONTRACTUAL_VACATION_DAYS` constants are replaced by values from `app_settings`.

## 4. Data Location

| Data | Where |
|---|---|
| Vacation records | DB (`vacation_records`) |
| Region, employment start date, display name | DB (`profiles`) |
| Statutory/contractual days, carry-over deadline | DB (`app_settings`) |
| Locale (en/zh) | localStorage (device preference) |
| Selected year | localStorage (UI state) |
| Backup/restore JSON feature | **Removed** — DB is the source of truth |

## 5. Admin Panel

New view, rendered only for admins (client-side gate for UX; RLS is the real boundary):

- **User table:** email, display name, role, active status, current-year vacation usage summary.
- **Per-user actions:** promote/demote admin, activate/deactivate, open modal to view + edit that user's vacation records.
- **Settings card:** edit global statutory days, contractual days, carry-over deadline.

## 6. Component Restructure

```
src/
  lib/supabase.ts
  contexts/AuthContext.tsx
  services/{vacations,profile,settings,admin}.ts
  hooks/{useVacations,useProfile,useSettings,useAdmin}.ts
  components/
    auth/LoginPage.tsx        — login + signup + forgot password
    dashboard/                — extracted from App.tsx:
      StatsCards.tsx, RecordList.tsx, RecordModal.tsx, YearNav.tsx, WelcomeModal.tsx
    admin/
      AdminPanel.tsx, UserTable.tsx, UserRecordsModal.tsx, SettingsCard.tsx
  App.tsx                     — thin shell: auth gate + view switching (dashboard / admin)
```

App.tsx (currently 844 lines) shrinks to a shell. Each extracted component has one purpose and its own props interface.

## 7. Configuration & Deploy

- `.env.example` documents `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. The anon key is safe to expose client-side; RLS enforces access control.
- `.env` git-ignored.
- SQL migrations live in `supabase/migrations/` (timestamped files), runnable via Supabase CLI or dashboard SQL editor.
- GitHub Pages deploy workflow unchanged except: Supabase env vars injected from GitHub Actions secrets at build time.

## 8. Error Handling

- Service calls throw typed errors; TanStack Query surfaces them.
- Mutation/query errors shown as i18n'd toast messages.
- Loading skeletons during initial data fetch.
- Optimistic updates roll back on mutation failure.

## 9. Testing

- **Vitest** for the entitlement/stats math (logic already exists, now gets tests).
- Service-layer tests with a mocked supabase client.
- RLS verification SQL script: assert user A cannot select/modify user B's rows, non-admin cannot update `app_settings` or change own `role`.

## Out of Scope

- Migration of existing localStorage data (fresh start decided)
- OAuth providers, magic links
- Per-user entitlements
- Email notifications, approval workflows (this is a personal tracker, not an HR tool)
- Backend API layer / Edge Functions
