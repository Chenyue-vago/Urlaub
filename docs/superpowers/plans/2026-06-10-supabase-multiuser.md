# Supabase Multi-User Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Urlaub vacation tracker from single-user localStorage to multi-user Supabase Postgres with email/password auth, per-user data isolation via RLS, and an admin panel.

**Architecture:** Static React SPA talks directly to Supabase via supabase-js; Row Level Security is the security boundary. TanStack Query manages server state with optimistic updates. App.tsx becomes a thin shell over extracted dashboard/admin components.

**Tech Stack:** React 18, TypeScript, Vite, @supabase/supabase-js v2, @tanstack/react-query v5, Vitest.

**Spec:** `docs/superpowers/specs/2026-06-10-supabase-multiuser-design.md`

**Branch:** `database_integration` (already checked out)

**Prerequisite (manual, user does this once):** A Supabase project exists. User has the project URL and anon key from Supabase Dashboard → Settings → API.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/001_initial_schema.sql` | Create | Tables, triggers, RLS policies, seed |
| `supabase/tests/rls_checks.sql` | Create | Manual RLS verification queries |
| `.env.example` | Create | Document required env vars |
| `.env` | Create (git-ignored) | Real credentials |
| `src/lib/supabase.ts` | Create | Singleton supabase client |
| `src/types.ts` | Modify | Add `Profile`, `AppSettings`, `userId` on `VacationRecord` |
| `src/utils.ts` | Modify | Inject entitlement config; delete localStorage/backup code |
| `src/utils.test.ts` | Create | Tests for stats math |
| `src/i18n.ts` | Modify | Auth/admin/error strings (en + zh) |
| `src/components/Toast.tsx` | Create | Toast context + display |
| `src/contexts/AuthContext.tsx` | Create | Session + profile + isAdmin |
| `src/services/vacations.ts` | Create | Vacation records CRUD + row mapping |
| `src/services/profile.ts` | Create | Own profile get/update |
| `src/services/settings.ts` | Create | Global settings get/update |
| `src/services/admin.ts` | Create | User management |
| `src/services/vacations.test.ts` | Create | Row mapping tests |
| `src/hooks/useVacations.ts` | Create | Query/mutation hooks for records |
| `src/hooks/useSettings.ts` | Create | Settings hooks |
| `src/hooks/useAdmin.ts` | Create | Admin hooks |
| `src/components/auth/LoginPage.tsx` | Create | Login/signup form |
| `src/components/dashboard/WelcomeModal.tsx` | Create | First-login employment date |
| `src/components/dashboard/SettingsModal.tsx` | Create | Employment date editing (backup UI removed) |
| `src/components/dashboard/YearNav.tsx` | Create | Year navigation |
| `src/components/dashboard/StatsCards.tsx` | Create | Stats cards grid |
| `src/components/dashboard/RecordModal.tsx` | Create | Add-vacation form modal |
| `src/components/dashboard/RecordList.tsx` | Create | Records list with workday slicing |
| `src/components/admin/AdminPanel.tsx` | Create | Admin view shell |
| `src/components/admin/UserTable.tsx` | Create | User list + actions |
| `src/components/admin/UserRecordsModal.tsx` | Create | View/delete a user's records |
| `src/components/admin/SettingsCard.tsx` | Create | Global settings editor |
| `src/App.tsx` | Modify | Rewire to DB, add view switch, drop backup/restore |
| `src/main.tsx` | Modify | QueryClientProvider + AuthProvider + ToastProvider |
| `.github/workflows/deploy.yml` | Modify | Inject Supabase env vars |
| `README.md` | Modify | Setup instructions |

---

### Task 1: Dependencies and test tooling

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install runtime deps**

```bash
cd /Users/shayekh00/Urlaub
npm install @supabase/supabase-js @tanstack/react-query
```

Expected: both added to `dependencies` in package.json.

- [ ] **Step 2: Install dev deps**

```bash
npm install -D vitest
```

- [ ] **Step 3: Add test script**

In `package.json` `"scripts"`, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 4: Verify vitest runs (no tests yet)**

Run: `npm test`
Expected: "No test files found" (exit code 1 is fine at this stage).

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add supabase-js, tanstack-query, vitest"
```

---

### Task 2: Database migration SQL

**Files:**
- Create: `supabase/migrations/001_initial_schema.sql`

- [ ] **Step 1: Write the migration file**

Create `supabase/migrations/001_initial_schema.sql` with exactly:

```sql
-- Urlaub multi-user schema: profiles, vacation_records, app_settings
-- Run via Supabase Dashboard SQL editor or `supabase db push`.

-- ============ tables ============

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  email text not null,
  display_name text,
  role text not null default 'user' check (role in ('user', 'admin')),
  region text not null default 'BW',
  employment_start_date date,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.vacation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles on delete cascade,
  start_date date not null,
  end_date date not null,
  work_days numeric not null check (work_days > 0),
  description text not null default '',
  type text not null check (type in ('statutory', 'contractual')),
  is_carry_over boolean not null default false,
  year int not null,
  created_at timestamptz not null default now()
);

create index vacation_records_user_year_idx
  on public.vacation_records (user_id, year);

create table public.app_settings (
  id int primary key check (id = 1),
  statutory_days int not null default 20 check (statutory_days >= 0),
  contractual_days int not null default 8 check (contractual_days >= 0),
  carry_over_deadline text not null default '03-31'
    check (carry_over_deadline ~ '^[0-1][0-9]-[0-3][0-9]$'),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (1);

-- ============ functions & triggers ============

-- Admin check. SECURITY DEFINER so it can read profiles without
-- recursing through profiles' own RLS policies.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- Auto-create a profile when a user signs up.
-- The very first profile becomes admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    coalesce(new.email, ''),
    case
      when not exists (select 1 from public.profiles) then 'admin'
      else 'user'
    end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Non-admins may not change role or is_active (their own included).
create or replace function public.enforce_profile_update_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.role is distinct from old.role
       or new.is_active is distinct from old.is_active then
      raise exception 'only admins may change role or active status';
    end if;
  end if;
  return new;
end;
$$;

create trigger profiles_update_guard
  before update on public.profiles
  for each row execute function public.enforce_profile_update_rules();

-- ============ row level security ============

alter table public.profiles enable row level security;
alter table public.vacation_records enable row level security;
alter table public.app_settings enable row level security;

create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

create policy profiles_update on public.profiles
  for update to authenticated
  using (id = auth.uid() or public.is_admin());

create policy vacation_select on public.vacation_records
  for select to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy vacation_insert on public.vacation_records
  for insert to authenticated
  with check (user_id = auth.uid() or public.is_admin());

create policy vacation_update on public.vacation_records
  for update to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy vacation_delete on public.vacation_records
  for delete to authenticated
  using (user_id = auth.uid() or public.is_admin());

create policy settings_select on public.app_settings
  for select to authenticated
  using (true);

create policy settings_update on public.app_settings
  for update to authenticated
  using (public.is_admin());
```

- [ ] **Step 2: Apply the migration**

Paste the file contents into Supabase Dashboard → SQL Editor → Run. (Or `supabase db push` if the CLI is linked.)

Expected: "Success. No rows returned".

- [ ] **Step 3: Verify tables exist**

In SQL Editor run: `select table_name from information_schema.tables where table_schema = 'public';`
Expected rows: `profiles`, `vacation_records`, `app_settings`.

- [ ] **Step 4: Disable email confirmation (optional but recommended for this app)**

Supabase Dashboard → Authentication → Sign In / Up → Email → toggle "Confirm email" OFF. (If left ON, the login page's "check your email" state handles it — see Task 10.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/001_initial_schema.sql
git commit -m "feat: add Supabase schema with RLS and first-user-admin bootstrap"
```

---

### Task 3: RLS verification script

**Files:**
- Create: `supabase/tests/rls_checks.sql`

- [ ] **Step 1: Write the verification script**

Create `supabase/tests/rls_checks.sql`:

```sql
-- Manual RLS verification. Run AFTER creating two users (one admin, one normal)
-- via the app's signup form. Replace the UUIDs below with real ones from:
--   select id, email, role from public.profiles;

-- ===== Setup: simulate the NORMAL user's JWT =====
-- Replace NORMAL_USER_UUID before running.
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', 'NORMAL_USER_UUID', 'role', 'authenticated')::text, true);
set local role authenticated;

-- 1. Normal user sees only their own profile (expect: 1 row)
select count(*) as own_profile_count from public.profiles;

-- 2. Normal user sees only their own vacation records
--    (expect: only rows with user_id = NORMAL_USER_UUID)
select distinct user_id from public.vacation_records;

-- 3. Normal user cannot insert a record for someone else (expect: ERROR)
insert into public.vacation_records
  (user_id, start_date, end_date, work_days, type, year)
values
  ('ADMIN_USER_UUID', '2026-01-05', '2026-01-05', 1, 'statutory', 2026);

rollback;

-- ===== 4. Normal user cannot update app_settings (expect: 0 rows updated) =====
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', 'NORMAL_USER_UUID', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.app_settings set statutory_days = 99 where id = 1;
select statutory_days from public.app_settings; -- expect: unchanged (20)
rollback;

-- ===== 5. Normal user cannot promote themselves (expect: ERROR from trigger) =====
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', 'NORMAL_USER_UUID', 'role', 'authenticated')::text, true);
set local role authenticated;
update public.profiles set role = 'admin' where id = 'NORMAL_USER_UUID';
rollback;

-- ===== 6. Admin sees all profiles (expect: count = total user count) =====
begin;
select set_config('request.jwt.claims',
  json_build_object('sub', 'ADMIN_USER_UUID', 'role', 'authenticated')::text, true);
set local role authenticated;
select count(*) as all_profiles_count from public.profiles;
rollback;
```

- [ ] **Step 2: Commit**

```bash
git add supabase/tests/rls_checks.sql
git commit -m "test: add manual RLS verification script"
```

(Actually running it happens in Task 18 once two users exist.)

---

### Task 4: Environment config and Supabase client

**Files:**
- Create: `.env.example`, `src/lib/supabase.ts`
- Modify: `.gitignore`

- [ ] **Step 1: Create `.env.example`**

```bash
# Supabase project credentials (Dashboard -> Settings -> API)
# The anon key is safe to expose in client code; RLS enforces access control.
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

- [ ] **Step 2: Create `.env` with real values** (user supplies them; never committed)

- [ ] **Step 3: Ensure `.env` is git-ignored**

Check `.gitignore` contains a `.env` line; if not, append:

```
.env
```

- [ ] **Step 4: Create `src/lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  throw new Error(
    'Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. ' +
      'Copy .env.example to .env and fill in your Supabase project credentials.'
  );
}

export const supabase = createClient(url, anonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
```

- [ ] **Step 5: Verify build still passes**

Run: `npm run build`
Expected: builds without errors (supabase.ts not imported anywhere yet, but compiles).

- [ ] **Step 6: Commit**

```bash
git add .env.example .gitignore src/lib/supabase.ts
git commit -m "feat: add supabase client and env configuration"
```

---

### Task 5: Type updates

**Files:**
- Modify: `src/types.ts`

- [ ] **Step 1: Add new types and extend VacationRecord**

In `src/types.ts`:

1. Add `userId: string;` to `VacationRecord` (after `id`).
2. Append at the end of the file:

```ts
import type { RegionCode } from './regions';

// 用户档案（对应 profiles 表）
export interface Profile {
  id: string;
  email: string;
  displayName: string | null;
  role: 'user' | 'admin';
  region: RegionCode;
  employmentStartDate: string | null; // ISO date or null until welcome modal done
  isActive: boolean;
  createdAt: string;
}

// 全局配置（对应 app_settings 表，单行）
export interface AppSettings {
  statutoryDays: number;
  contractualDays: number;
  carryOverDeadline: string; // 'MM-DD', e.g. '03-31'
}

// 新建假期记录的输入（id/createdAt 由数据库生成，userId 由调用方注入）
export type NewVacationRecord = Omit<VacationRecord, 'id' | 'userId' | 'createdAt'>;
```

Note: the `import type` line goes at the TOP of the file, not the end.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: errors ONLY about `userId` missing in App.tsx record literals (fixed in Task 14). If other errors appear, fix them now.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add Profile, AppSettings, NewVacationRecord types"
```

---

### Task 6: utils.ts — entitlement config injection (TDD)

The hardcoded 20/8/`03-31` constants become an injectable `EntitlementConfig` so values can come from `app_settings`. Existing call sites keep working via a default.

**Files:**
- Create: `src/utils.test.ts`
- Modify: `src/utils.ts`

- [ ] **Step 1: Write failing tests**

Create `src/utils.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  getYearlyEntitlement,
  calculateYearlyStats,
  calculateCarryOver,
  DEFAULT_ENTITLEMENT,
  EntitlementConfig,
} from './utils';
import { VacationRecord } from './types';

const CUSTOM: EntitlementConfig = {
  statutoryDays: 25,
  contractualDays: 5,
  carryOverDeadline: '03-31',
};

function rec(partial: Partial<VacationRecord>): VacationRecord {
  return {
    id: 'r1',
    userId: 'u1',
    startDate: '2026-06-01',
    endDate: '2026-06-01',
    workDays: 1,
    description: '',
    type: 'statutory',
    year: 2026,
    createdAt: '2026-06-01T00:00:00Z',
    ...partial,
  };
}

describe('getYearlyEntitlement', () => {
  it('returns config values when no employment start date', () => {
    expect(getYearlyEntitlement(2026, undefined, CUSTOM)).toEqual({
      statutoryTotal: 25,
      contractualTotal: 5,
    });
  });

  it('defaults to 20/8 when config omitted', () => {
    expect(getYearlyEntitlement(2026)).toEqual({
      statutoryTotal: 20,
      contractualTotal: 8,
    });
  });

  it('pro-rates the start year by remaining months', () => {
    // start July 2026 -> 6 eligible months -> ceil(20*6/12)=10, ceil(8*6/12)=4
    expect(getYearlyEntitlement(2026, '2026-07-15')).toEqual({
      statutoryTotal: 10,
      contractualTotal: 4,
    });
  });

  it('returns zero before employment start year', () => {
    expect(getYearlyEntitlement(2025, '2026-07-15')).toEqual({
      statutoryTotal: 0,
      contractualTotal: 0,
    });
  });
});

describe('calculateYearlyStats', () => {
  it('uses injected config for totals', () => {
    const stats = calculateYearlyStats([], 2026, 0, undefined, CUSTOM);
    expect(stats.statutoryTotal).toBe(25);
    expect(stats.contractualTotal).toBe(5);
  });

  it('counts carry-over used only before the deadline', () => {
    const records = [
      rec({ startDate: '2026-02-01', endDate: '2026-02-01', workDays: 3, year: 2026 }),
      rec({ id: 'r2', startDate: '2026-05-01', endDate: '2026-05-01', workDays: 2, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4, undefined);
    expect(stats.carryOverUsed).toBe(3); // only the Feb record is before 03-31
    expect(stats.carryOverExpired).toBe(1); // 4 - 3
  });

  it('respects a custom carry-over deadline', () => {
    const config: EntitlementConfig = { ...DEFAULT_ENTITLEMENT, carryOverDeadline: '06-30' };
    const records = [
      rec({ startDate: '2026-05-01', endDate: '2026-05-01', workDays: 2, year: 2026 }),
    ];
    const stats = calculateYearlyStats(records, 2026, 4, undefined, config);
    expect(stats.carryOverUsed).toBe(2); // May is before 06-30 now
  });
});

describe('calculateCarryOver', () => {
  it('carries over unused statutory days', () => {
    const records = [
      rec({ startDate: '2025-08-01', endDate: '2025-08-01', workDays: 15, year: 2025 }),
    ];
    // 20 statutory - 15 used = 5 carried into 2026
    expect(calculateCarryOver(records, 2025, undefined)).toBe(5);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `DEFAULT_ENTITLEMENT` / `EntitlementConfig` not exported; signature mismatches.

- [ ] **Step 3: Refactor utils.ts**

In `src/utils.ts`:

Replace the constants block (lines 5-10) with:

```ts
// 默认配置 —— 实际运行时值来自 app_settings 表；这里仅作回退与测试默认
export interface EntitlementConfig {
  statutoryDays: number;
  contractualDays: number;
  carryOverDeadline: string; // 'MM-DD'
}

export const DEFAULT_ENTITLEMENT: EntitlementConfig = {
  statutoryDays: 20,
  contractualDays: 8,
  carryOverDeadline: '03-31',
};
```

Update `getYearlyEntitlement` to:

```ts
export function getYearlyEntitlement(
  year: number,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): { statutoryTotal: number; contractualTotal: number } {
  if (!employmentStartDate) {
    return {
      statutoryTotal: config.statutoryDays,
      contractualTotal: config.contractualDays,
    };
  }

  const start = parseDate(employmentStartDate);
  const startYear = start.getFullYear();
  const startMonthIndex = start.getMonth();

  if (year < startYear) {
    return { statutoryTotal: 0, contractualTotal: 0 };
  }

  if (year === startYear) {
    const monthsEligible = 12 - startMonthIndex;
    return {
      statutoryTotal: Math.ceil((config.statutoryDays * monthsEligible) / 12),
      contractualTotal: Math.ceil((config.contractualDays * monthsEligible) / 12),
    };
  }

  return {
    statutoryTotal: config.statutoryDays,
    contractualTotal: config.contractualDays,
  };
}
```

Update `calculateYearlyStats` signature and deadline line:

```ts
export function calculateYearlyStats(
  records: VacationRecord[],
  year: number,
  carryOverFromPreviousYear: number = 0,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): YearlyVacationStats {
```

and inside, replace `` const carryOverDeadline = `${year}-03-31`; `` with:

```ts
  const carryOverDeadline = `${year}-${config.carryOverDeadline}`;
```

and replace `const entitlement = getYearlyEntitlement(year, employmentStartDate);` with:

```ts
  const entitlement = getYearlyEntitlement(year, employmentStartDate, config);
```

Update `calculateCarryOver`:

```ts
export function calculateCarryOver(
  records: VacationRecord[],
  fromYear: number,
  employmentStartDate?: string,
  config: EntitlementConfig = DEFAULT_ENTITLEMENT
): number {
  const stats = calculateYearlyStats(records, fromYear, 0, employmentStartDate, config);
  return stats.statutoryRemaining;
}
```

Delete the now-unused exports `STATUTORY_VACATION_DAYS`, `CONTRACTUAL_VACATION_DAYS`, `TOTAL_VACATION_DAYS` (verify with `grep -rn "VACATION_DAYS" src/` — only utils.ts should match before deleting).

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 5: Type-check** (App.tsx still compiles — its calls use the defaults)

Run: `npx tsc --noEmit`
Expected: only the pre-existing `userId` errors from Task 5.

- [ ] **Step 6: Commit**

```bash
git add src/utils.ts src/utils.test.ts
git commit -m "refactor: inject entitlement config into vacation math, with tests"
```

---

### Task 7: i18n strings

**Files:**
- Modify: `src/i18n.ts`

- [ ] **Step 1: Add new keys to BOTH the `en` and `zh` dictionaries**

Add to the `en` dict:

```ts
  // auth
  'auth.title': 'Sign in to Urlaub',
  'auth.subtitle': 'Track your vacation days',
  'auth.loginTab': 'Sign in',
  'auth.signupTab': 'Create account',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.displayName': 'Display name (optional)',
  'auth.submitLogin': 'Sign in',
  'auth.submitSignup': 'Create account',
  'auth.checkEmail': 'Check your email to confirm your account, then sign in.',
  'auth.errorInvalidCredentials': 'Invalid email or password.',
  'auth.errorWeakPassword': 'Password must be at least 6 characters.',
  'auth.errorGeneric': 'Something went wrong. Please try again.',
  'auth.deactivated': 'Your account has been deactivated. Contact an administrator.',
  'auth.signOut': 'Sign out',
  // navigation
  'nav.dashboard': 'Dashboard',
  'nav.admin': 'Admin',
  // common
  'common.loading': 'Loading…',
  'common.saveFailed': 'Saving failed. Please try again.',
  'common.loadFailed': 'Loading data failed. Please reload the page.',
  // admin
  'admin.title': 'Administration',
  'admin.usersTitle': 'Users',
  'admin.colEmail': 'Email',
  'admin.colName': 'Name',
  'admin.colRole': 'Role',
  'admin.colStatus': 'Status',
  'admin.colUsage': 'Used this year',
  'admin.colActions': 'Actions',
  'admin.roleAdmin': 'Admin',
  'admin.roleUser': 'User',
  'admin.statusActive': 'Active',
  'admin.statusInactive': 'Deactivated',
  'admin.promote': 'Make admin',
  'admin.demote': 'Remove admin',
  'admin.deactivate': 'Deactivate',
  'admin.activate': 'Activate',
  'admin.viewRecords': 'Records',
  'admin.recordsOf': 'Vacation records — {email}',
  'admin.noRecords': 'No records.',
  'admin.usageSummary': '{used} of {total} days',
  'admin.settingsTitle': 'Global settings',
  'admin.statutoryDays': 'Statutory vacation days',
  'admin.contractualDays': 'Contractual vacation days',
  'admin.carryOverDeadline': 'Carry-over deadline (MM-DD)',
  'admin.save': 'Save settings',
  'admin.saved': 'Settings saved.',
  'admin.confirmDeleteRecord': 'Delete this record?',
```

Add to the `zh` dict:

```ts
  // auth
  'auth.title': '登录 Urlaub',
  'auth.subtitle': '管理你的假期',
  'auth.loginTab': '登录',
  'auth.signupTab': '注册',
  'auth.email': '邮箱',
  'auth.password': '密码',
  'auth.displayName': '昵称（可选）',
  'auth.submitLogin': '登录',
  'auth.submitSignup': '创建账号',
  'auth.checkEmail': '请查收邮件确认账号，然后登录。',
  'auth.errorInvalidCredentials': '邮箱或密码错误。',
  'auth.errorWeakPassword': '密码至少需要 6 个字符。',
  'auth.errorGeneric': '出错了，请重试。',
  'auth.deactivated': '你的账号已被停用，请联系管理员。',
  'auth.signOut': '退出登录',
  // navigation
  'nav.dashboard': '面板',
  'nav.admin': '管理',
  // common
  'common.loading': '加载中…',
  'common.saveFailed': '保存失败，请重试。',
  'common.loadFailed': '数据加载失败，请刷新页面。',
  // admin
  'admin.title': '管理后台',
  'admin.usersTitle': '用户',
  'admin.colEmail': '邮箱',
  'admin.colName': '昵称',
  'admin.colRole': '角色',
  'admin.colStatus': '状态',
  'admin.colUsage': '今年已用',
  'admin.colActions': '操作',
  'admin.roleAdmin': '管理员',
  'admin.roleUser': '用户',
  'admin.statusActive': '正常',
  'admin.statusInactive': '已停用',
  'admin.promote': '设为管理员',
  'admin.demote': '取消管理员',
  'admin.deactivate': '停用',
  'admin.activate': '启用',
  'admin.viewRecords': '记录',
  'admin.recordsOf': '假期记录 — {email}',
  'admin.noRecords': '暂无记录。',
  'admin.usageSummary': '已用 {used} / {total} 天',
  'admin.settingsTitle': '全局设置',
  'admin.statutoryDays': '法定假期天数',
  'admin.contractualDays': '合同假期天数',
  'admin.carryOverDeadline': '结转截止日（MM-DD）',
  'admin.save': '保存设置',
  'admin.saved': '设置已保存。',
  'admin.confirmDeleteRecord': '删除这条记录？',
```

Also DELETE these now-unused keys from both dicts (backup feature removed): `settings.backupTitle`, `settings.backupHint`, `settings.export`, `settings.import`, `settings.importConfirm`, `settings.importError`, `settings.importSuccess`. (Verify exact key names with `grep -n "settings\." src/i18n.ts` first; only delete backup-related ones.)

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: new errors in App.tsx where deleted backup keys are used — expected; App.tsx is rewired in Task 14. No errors inside i18n.ts itself.

- [ ] **Step 3: Commit**

```bash
git add src/i18n.ts
git commit -m "feat: add auth and admin i18n strings, drop backup strings"
```

---

### Task 8: Toast component

**Files:**
- Create: `src/components/Toast.tsx`

- [ ] **Step 1: Create the component**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  ReactNode,
} from 'react';

interface ToastMessage {
  id: number;
  text: string;
  kind: 'error' | 'success';
}

interface ToastContextValue {
  showError: (text: string) => void;
  showSuccess: (text: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const nextId = useRef(0);

  const push = useCallback((text: string, kind: ToastMessage['kind']) => {
    const id = nextId.current++;
    setToasts((prev) => [...prev, { id, text, kind }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 4000);
  }, []);

  const showError = useCallback((text: string) => push(text, 'error'), [push]);
  const showSuccess = useCallback((text: string) => push(text, 'success'), [push]);

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-container" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <div key={toast.id} className={`toast toast-${toast.kind}`}>
              {toast.text}
            </div>
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
```

- [ ] **Step 2: Add styles to `src/index.css`** (append at end)

```css
/* Toasts */
.toast-container {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  z-index: 1000;
}
.toast {
  padding: 0.75rem 1.25rem;
  border-radius: 8px;
  color: #fff;
  font-size: 0.9rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.toast-error { background: #dc2626; }
.toast-success { background: #16a34a; }
```

- [ ] **Step 3: Type-check, commit**

Run: `npx tsc --noEmit` (same pre-existing App.tsx errors only)

```bash
git add src/components/Toast.tsx src/index.css
git commit -m "feat: add toast notifications"
```

---

### Task 9: Services layer

**Files:**
- Create: `src/services/vacations.ts`, `src/services/profile.ts`, `src/services/settings.ts`, `src/services/admin.ts`, `src/services/vacations.test.ts`

- [ ] **Step 1: Write failing mapping tests**

Create `src/services/vacations.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { rowToRecord, recordToRow, VacationRow } from './vacations';
import { NewVacationRecord } from '../types';

describe('vacation row mapping', () => {
  const row: VacationRow = {
    id: 'abc',
    user_id: 'u1',
    start_date: '2026-01-05',
    end_date: '2026-01-09',
    work_days: 5,
    description: 'Ski trip',
    type: 'statutory',
    is_carry_over: true,
    year: 2026,
    created_at: '2026-01-01T10:00:00Z',
  };

  it('maps a DB row to a VacationRecord', () => {
    expect(rowToRecord(row)).toEqual({
      id: 'abc',
      userId: 'u1',
      startDate: '2026-01-05',
      endDate: '2026-01-09',
      workDays: 5,
      description: 'Ski trip',
      type: 'statutory',
      isCarryOver: true,
      year: 2026,
      createdAt: '2026-01-01T10:00:00Z',
    });
  });

  it('maps a NewVacationRecord to an insertable row', () => {
    const record: NewVacationRecord = {
      startDate: '2026-01-05',
      endDate: '2026-01-09',
      workDays: 5,
      description: '',
      type: 'contractual',
      isCarryOver: false,
      year: 2026,
    };
    expect(recordToRow(record, 'u1')).toEqual({
      user_id: 'u1',
      start_date: '2026-01-05',
      end_date: '2026-01-09',
      work_days: 5,
      description: '',
      type: 'contractual',
      is_carry_over: false,
      year: 2026,
    });
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npm test`
Expected: FAIL — module `./vacations` not found.

- [ ] **Step 3: Create `src/services/vacations.ts`**

```ts
import { supabase } from '../lib/supabase';
import { NewVacationRecord, VacationRecord } from '../types';

export interface VacationRow {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  work_days: number;
  description: string;
  type: 'statutory' | 'contractual';
  is_carry_over: boolean;
  year: number;
  created_at: string;
}

export function rowToRecord(row: VacationRow): VacationRecord {
  return {
    id: row.id,
    userId: row.user_id,
    startDate: row.start_date,
    endDate: row.end_date,
    workDays: Number(row.work_days),
    description: row.description,
    type: row.type,
    isCarryOver: row.is_carry_over,
    year: row.year,
    createdAt: row.created_at,
  };
}

export function recordToRow(
  record: NewVacationRecord,
  userId: string
): Omit<VacationRow, 'id' | 'created_at'> {
  return {
    user_id: userId,
    start_date: record.startDate,
    end_date: record.endDate,
    work_days: record.workDays,
    description: record.description,
    type: record.type,
    is_carry_over: record.isCarryOver ?? false,
    year: record.year,
  };
}

// RLS scopes results to the caller automatically; userId filter is for admins
// viewing a specific user's records.
export async function listVacations(userId?: string): Promise<VacationRecord[]> {
  let query = supabase
    .from('vacation_records')
    .select('*')
    .order('start_date', { ascending: false });
  if (userId) query = query.eq('user_id', userId);
  const { data, error } = await query;
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function createVacations(
  records: NewVacationRecord[],
  userId: string
): Promise<VacationRecord[]> {
  const rows = records.map((record) => recordToRow(record, userId));
  const { data, error } = await supabase
    .from('vacation_records')
    .insert(rows)
    .select();
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function deleteVacation(id: string): Promise<void> {
  const { error } = await supabase.from('vacation_records').delete().eq('id', id);
  if (error) throw error;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS. (`lib/supabase.ts` throws if env vars missing at import time — vitest loads `.env` via Vite automatically. If the suite errors on missing env, create `.env` first as per Task 4 Step 2.)

- [ ] **Step 5: Create `src/services/profile.ts`**

```ts
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { RegionCode } from '../regions';

export interface ProfileRow {
  id: string;
  email: string;
  display_name: string | null;
  role: 'user' | 'admin';
  region: string;
  employment_start_date: string | null;
  is_active: boolean;
  created_at: string;
}

export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    region: row.region as RegionCode,
    employmentStartDate: row.employment_start_date,
    isActive: row.is_active,
    createdAt: row.created_at,
  };
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToProfile(data as ProfileRow) : null;
}

export interface ProfileUpdate {
  displayName?: string;
  region?: RegionCode;
  employmentStartDate?: string;
}

export async function updateProfile(
  userId: string,
  update: ProfileUpdate
): Promise<void> {
  const row: Record<string, unknown> = {};
  if (update.displayName !== undefined) row.display_name = update.displayName;
  if (update.region !== undefined) row.region = update.region;
  if (update.employmentStartDate !== undefined) {
    row.employment_start_date = update.employmentStartDate;
  }
  const { error } = await supabase.from('profiles').update(row).eq('id', userId);
  if (error) throw error;
}
```

- [ ] **Step 6: Create `src/services/settings.ts`**

```ts
import { supabase } from '../lib/supabase';
import { AppSettings } from '../types';

interface SettingsRow {
  id: number;
  statutory_days: number;
  contractual_days: number;
  carry_over_deadline: string;
  updated_at: string;
}

export async function getSettings(): Promise<AppSettings> {
  const { data, error } = await supabase
    .from('app_settings')
    .select('*')
    .eq('id', 1)
    .single();
  if (error) throw error;
  const row = data as SettingsRow;
  return {
    statutoryDays: row.statutory_days,
    contractualDays: row.contractual_days,
    carryOverDeadline: row.carry_over_deadline,
  };
}

export async function updateSettings(settings: AppSettings): Promise<void> {
  const { error } = await supabase
    .from('app_settings')
    .update({
      statutory_days: settings.statutoryDays,
      contractual_days: settings.contractualDays,
      carry_over_deadline: settings.carryOverDeadline,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1);
  if (error) throw error;
}
```

- [ ] **Step 7: Create `src/services/admin.ts`**

```ts
import { supabase } from '../lib/supabase';
import { Profile, VacationRecord } from '../types';
import { ProfileRow, rowToProfile } from './profile';
import { VacationRow, rowToRecord } from './vacations';

// Admin-only (RLS rejects these for normal users).

export async function listProfiles(): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data as ProfileRow[]).map(rowToProfile);
}

export async function listAllVacations(): Promise<VacationRecord[]> {
  const { data, error } = await supabase.from('vacation_records').select('*');
  if (error) throw error;
  return (data as VacationRow[]).map(rowToRecord);
}

export async function setUserRole(
  userId: string,
  role: 'user' | 'admin'
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ role })
    .eq('id', userId);
  if (error) throw error;
}

export async function setUserActive(
  userId: string,
  isActive: boolean
): Promise<void> {
  const { error } = await supabase
    .from('profiles')
    .update({ is_active: isActive })
    .eq('id', userId);
  if (error) throw error;
}
```

- [ ] **Step 8: Run tests + type-check**

Run: `npm test && npx tsc --noEmit`
Expected: tests PASS; only pre-existing App.tsx errors.

- [ ] **Step 9: Commit**

```bash
git add src/services/
git commit -m "feat: add supabase service layer with row mapping tests"
```

---

### Task 10: AuthContext and LoginPage

**Files:**
- Create: `src/contexts/AuthContext.tsx`, `src/components/auth/LoginPage.tsx`

- [ ] **Step 1: Create `src/contexts/AuthContext.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { Profile } from '../types';
import { getProfile } from '../services/profile';

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  loading: boolean;
  deactivated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    displayName?: string
  ) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [deactivated, setDeactivated] = useState(false);

  const loadProfile = useCallback(async (userId: string) => {
    const fetched = await getProfile(userId);
    if (fetched && !fetched.isActive) {
      setDeactivated(true);
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }
    setProfile(fetched);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) {
        loadProfile(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    setDeactivated(false);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(
    async (email: string, password: string, displayName?: string) => {
      setDeactivated(false);
      const { data, error } = await supabase.auth.signUp({ email, password });
      if (error) throw error;
      // session is null when email confirmation is required
      if (data.session && displayName) {
        await supabase
          .from('profiles')
          .update({ display_name: displayName })
          .eq('id', data.session.user.id);
      }
      return { needsEmailConfirmation: !data.session };
    },
    []
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session) await loadProfile(session.user.id);
  }, [session, loadProfile]);

  return (
    <AuthContext.Provider
      value={{
        session,
        profile,
        isAdmin: profile?.role === 'admin',
        loading,
        deactivated,
        signIn,
        signUp,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
```

- [ ] **Step 2: Create `src/components/auth/LoginPage.tsx`**

```tsx
import { useState, FormEvent } from 'react';
import { Palmtree } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useTranslation } from '../../i18n';

export function LoginPage() {
  const { signIn, signUp, deactivated } = useAuth();
  const { t } = useTranslation();
  const [mode, setMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setInfo('');
    setSubmitting(true);
    try {
      if (mode === 'login') {
        await signIn(email, password);
      } else {
        const { needsEmailConfirmation } = await signUp(
          email,
          password,
          displayName.trim() || undefined
        );
        if (needsEmailConfirmation) setInfo(t('auth.checkEmail'));
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : '';
      if (/invalid login credentials/i.test(message)) {
        setError(t('auth.errorInvalidCredentials'));
      } else if (/password/i.test(message) && /6/.test(message)) {
        setError(t('auth.errorWeakPassword'));
      } else {
        setError(t('auth.errorGeneric'));
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="logo">
          <Palmtree size={32} />
          <h1>{t('auth.title')}</h1>
        </div>
        <p className="subtitle">{t('auth.subtitle')}</p>

        <div className="auth-tabs">
          <button
            type="button"
            className={mode === 'login' ? 'active' : ''}
            onClick={() => setMode('login')}
          >
            {t('auth.loginTab')}
          </button>
          <button
            type="button"
            className={mode === 'signup' ? 'active' : ''}
            onClick={() => setMode('signup')}
          >
            {t('auth.signupTab')}
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>{t('auth.email')}</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-group">
            <label>{t('auth.password')}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            />
          </div>
          {mode === 'signup' && (
            <div className="form-group">
              <label>{t('auth.displayName')}</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
          )}
          {deactivated && <p className="form-error">{t('auth.deactivated')}</p>}
          {error && <p className="form-error">{error}</p>}
          {info && <p className="form-info">{info}</p>}
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {mode === 'login' ? t('auth.submitLogin') : t('auth.submitSignup')}
          </button>
        </form>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Add auth styles to `src/index.css`** (append)

```css
/* Auth page */
.auth-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
}
.auth-card {
  width: 100%;
  max-width: 380px;
  background: var(--card-bg, #fff);
  border-radius: 12px;
  padding: 2rem;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
}
.auth-card .logo { justify-content: center; }
.auth-card .subtitle { text-align: center; margin-bottom: 1.5rem; }
.auth-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.25rem;
}
.auth-tabs button {
  flex: 1;
  padding: 0.5rem;
  border: 1px solid #d1d5db;
  background: transparent;
  border-radius: 8px;
  cursor: pointer;
}
.auth-tabs button.active {
  background: #166534;
  color: #fff;
  border-color: #166534;
}
.auth-card form .btn { width: 100%; margin-top: 0.5rem; }
.form-info { color: #166534; font-size: 0.9rem; }
```

(If `--card-bg` doesn't exist in index.css, plain `#fff` is used via the fallback.)

- [ ] **Step 4: Type-check, commit**

Run: `npx tsc --noEmit` — only pre-existing App.tsx errors.

```bash
git add src/contexts/AuthContext.tsx src/components/auth/ src/index.css
git commit -m "feat: add auth context and login page"
```

---

### Task 11: Query hooks

**Files:**
- Create: `src/hooks/useVacations.ts`, `src/hooks/useSettings.ts`, `src/hooks/useAdmin.ts`

- [ ] **Step 1: Create `src/hooks/useVacations.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { NewVacationRecord, VacationRecord } from '../types';
import {
  createVacations,
  deleteVacation,
  listVacations,
} from '../services/vacations';

// IMPORTANT: always scope by userId. Admins' RLS lets them SELECT every row,
// so an unfiltered listVacations() would mix other users' records into the
// admin's own dashboard stats.
function vacationsKey(userId: string) {
  return ['vacations', userId];
}

export function useVacations(userId: string) {
  return useQuery({
    queryKey: vacationsKey(userId),
    queryFn: () => listVacations(userId),
    enabled: !!userId,
  });
}

export function useCreateVacations(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (records: NewVacationRecord[]) => createVacations(records, userId),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: vacationsKey(userId) }),
  });
}

export function useDeleteVacation(userId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: deleteVacation,
    // optimistic removal; rolled back on error
    onMutate: async (id: string) => {
      const key = vacationsKey(userId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<VacationRecord[]>(key);
      queryClient.setQueryData<VacationRecord[]>(key, (old) =>
        (old ?? []).filter((record) => record.id !== id)
      );
      return { previous };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(vacationsKey(userId), context.previous);
      }
    },
    onSettled: () =>
      queryClient.invalidateQueries({ queryKey: vacationsKey(userId) }),
  });
}
```

- [ ] **Step 2: Create `src/hooks/useSettings.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AppSettings } from '../types';
import { getSettings, updateSettings } from '../services/settings';
import { DEFAULT_ENTITLEMENT, EntitlementConfig } from '../utils';

const KEY = ['settings'];

// `enabled` gates the query until the user is authenticated —
// app_settings RLS rejects anonymous reads.
export function useSettings(enabled: boolean = true) {
  return useQuery({
    queryKey: KEY,
    queryFn: getSettings,
    staleTime: 5 * 60_000,
    enabled,
  });
}

// Convenience: settings as EntitlementConfig with safe fallback while loading
export function useEntitlementConfig(enabled: boolean = true): EntitlementConfig {
  const { data } = useSettings(enabled);
  if (!data) return DEFAULT_ENTITLEMENT;
  return {
    statutoryDays: data.statutoryDays,
    contractualDays: data.contractualDays,
    carryOverDeadline: data.carryOverDeadline,
  };
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (settings: AppSettings) => updateSettings(settings),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}
```

- [ ] **Step 3: Create `src/hooks/useAdmin.ts`**

```ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  listAllVacations,
  listProfiles,
  setUserActive,
  setUserRole,
} from '../services/admin';

const USERS_KEY = ['admin', 'users'];
const ALL_VACATIONS_KEY = ['admin', 'vacations'];

export function useAdminUsers(enabled: boolean) {
  return useQuery({ queryKey: USERS_KEY, queryFn: listProfiles, enabled });
}

export function useAdminVacations(enabled: boolean) {
  return useQuery({
    queryKey: ALL_VACATIONS_KEY,
    queryFn: listAllVacations,
    enabled,
  });
}

export function useSetUserRole() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: 'user' | 'admin' }) =>
      setUserRole(userId, role),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}

export function useSetUserActive() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, isActive }: { userId: string; isActive: boolean }) =>
      setUserActive(userId, isActive),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: USERS_KEY }),
  });
}
```

- [ ] **Step 4: Type-check, commit**

```bash
npx tsc --noEmit
git add src/hooks/
git commit -m "feat: add tanstack-query hooks for vacations, settings, admin"
```

---

### Task 12: Provider wiring in main.tsx

**Files:**
- Modify: `src/main.tsx`

- [ ] **Step 1: Wrap the app**

Replace `src/main.tsx` content with:

```tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { LanguageProvider } from './i18n';
import { AuthProvider } from './contexts/AuthContext';
import { ToastProvider } from './components/Toast';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, refetchOnWindowFocus: false },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <AuthProvider>
          <ToastProvider>
            <App />
          </ToastProvider>
        </AuthProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </React.StrictMode>
);
```

(Check the current `main.tsx` first — keep any existing provider it already has; `LanguageProvider` already exists there.)

- [ ] **Step 2: Type-check, commit**

```bash
npx tsc --noEmit
git add src/main.tsx
git commit -m "feat: wire query client, auth, and toast providers"
```

---

### Task 13: WelcomeModal and SettingsModal components

These are extracted BEFORE the App.tsx rewire so the rewire can use them.

**Files:**
- Create: `src/components/dashboard/WelcomeModal.tsx`, `src/components/dashboard/SettingsModal.tsx`

- [ ] **Step 1: Create `src/components/dashboard/WelcomeModal.tsx`**

Behavior identical to the current welcome modal in App.tsx lines 797-839, but saves to the profile via callback:

```tsx
import { useState } from 'react';
import { getTranslator } from '../../i18n';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface WelcomeModalProps {
  onSubmit: (employmentStartDate: string) => void;
}

// 固定英文显示，避免残留语言偏好让新同事困惑
export function WelcomeModal({ onSubmit }: WelcomeModalProps) {
  const tw = getTranslator('en');
  const [draftDate, setDraftDate] = useState('');
  const [error, setError] = useState(false);

  return (
    <div className="modal-overlay welcome-overlay">
      <div className="modal welcome-modal" onClick={(e) => e.stopPropagation()}>
        <h2>{tw('welcome.title')}</h2>
        <p className="welcome-body">{tw('welcome.body')}</p>
        <div className="form-group">
          <label>{tw('settings.employmentStartLabel')}</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => {
              setDraftDate(e.target.value);
              if (e.target.value) setError(false);
            }}
          />
          {error && <p className="form-error">{tw('welcome.required')}</p>}
        </div>
        <div className="modal-actions">
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!isValidIsoDate(draftDate)) {
                setError(true);
                return;
              }
              onSubmit(draftDate);
            }}
          >
            {tw('welcome.continue')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/dashboard/SettingsModal.tsx`**

Same as the current settings modal (App.tsx lines 730-793) minus the backup/restore section:

```tsx
import { useState } from 'react';
import { useTranslation } from '../../i18n';

function isValidIsoDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return !Number.isNaN(new Date(s).getTime());
}

interface SettingsModalProps {
  initialDate: string;
  onSave: (employmentStartDate: string) => void;
  onClose: () => void;
}

export function SettingsModal({ initialDate, onSave, onClose }: SettingsModalProps) {
  const { t } = useTranslation();
  const [draftDate, setDraftDate] = useState(initialDate);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('settings.title')}</h2>
        <div className="form-group">
          <label>{t('settings.employmentStartLabel')}</label>
          <input
            type="date"
            value={draftDate}
            onChange={(e) => setDraftDate(e.target.value)}
          />
          <p className="form-hint">{t('settings.employmentStartHint')}</p>
        </div>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('settings.cancel')}
          </button>
          <button
            className="btn btn-primary"
            disabled={!isValidIsoDate(draftDate)}
            onClick={() => {
              if (!isValidIsoDate(draftDate)) return;
              onSave(draftDate);
            }}
          >
            {t('settings.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Type-check, commit**

```bash
npx tsc --noEmit
git add src/components/dashboard/
git commit -m "feat: extract welcome and settings modals as components"
```

---

### Task 14: Rewire App.tsx to the database

This is the core integration task. App.tsx keeps its dashboard JSX but all persistence moves to Supabase.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/utils.ts` (delete dead storage code)

- [ ] **Step 1: Replace imports and state setup in App.tsx**

At the top of `App()`, replace the current state initialization (lines 47-178) with:

```tsx
function App() {
  const { locale, setLocale, t } = useTranslation();
  const { profile, isAdmin, signOut, refreshProfile, loading: authLoading } = useAuth();
  const { showError } = useToast();

  // 服务器状态（全部按当前用户 id 限定 —— 管理员的 RLS 能看到所有行，必须显式过滤）
  const { data: records = [], isLoading: recordsLoading, isError: recordsError } =
    useVacations(profile?.id ?? '');
  const entitlement = useEntitlementConfig(!!profile);
  const createMutation = useCreateVacations(profile?.id ?? '');
  const deleteMutation = useDeleteVacation(profile?.id ?? '');

  // 个人资料派生值（来自 DB，不再读 localStorage）
  const region: RegionCode = profile?.region ?? DEFAULT_REGION;
  const employmentStartDate = profile?.employmentStartDate ?? '';

  // 纯 UI 状态（保留在 localStorage / 本地）
  const [selectedYear, setSelectedYear] = useState(() => {
    const stored = localStorage.getItem('urlaub_selected_year');
    const parsed = stored ? Number(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : new Date().getFullYear();
  });
  const [showAddForm, setShowAddForm] = useState(false);
  const [showHolidays, setShowHolidays] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [view, setView] = useState<'dashboard' | 'admin'>('dashboard');

  // 表单状态
  const [formStartDate, setFormStartDate] = useState('');
  const [formEndDate, setFormEndDate] = useState('');
  const [formDescription, setFormDescription] = useState('');

  useEffect(() => {
    localStorage.setItem('urlaub_selected_year', String(selectedYear));
  }, [selectedYear]);

  const handleRegionChange = async (newRegion: RegionCode) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { region: newRegion });
      await refreshProfile();
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  const handleEmploymentDateSave = async (date: string) => {
    if (!profile) return;
    try {
      await updateProfile(profile.id, { employmentStartDate: date });
      await refreshProfile();
      setShowSettings(false);
    } catch {
      showError(t('common.saveFailed'));
    }
  };
```

New imports needed at top of file:

```tsx
import { useAuth } from './contexts/AuthContext';
import { useToast } from './components/Toast';
import { useVacations, useCreateVacations, useDeleteVacation } from './hooks/useVacations';
import { useEntitlementConfig } from './hooks/useSettings';
import { updateProfile } from './services/profile';
import { LoginPage } from './components/auth/LoginPage';
import { WelcomeModal } from './components/dashboard/WelcomeModal';
import { SettingsModal } from './components/dashboard/SettingsModal';
import { AdminPanel } from './components/admin/AdminPanel';
import { NewVacationRecord } from './types';
```

Remove imports that are no longer used: `generateId`, `saveToStorage`, `loadFromStorage`, `exportAllData`, `importAllData`, `useRef`.

Delete entirely: `REGION_STORAGE_KEY`, `EMPLOYMENT_START_STORAGE_KEY` constants, the module-level `isValidIsoDate` helper (moved into the modal components), `handleExportBackup`, `handleImportFileChosen`, the `importInputRef`, the welcome-modal state (`showWelcome`, `welcomeDraftDate`, `welcomeError`), `settingsDraftDate` state, and all `localStorage` reads/writes except `urlaub_selected_year`.

- [ ] **Step 2: Thread the entitlement config through the math calls**

Everywhere in App.tsx that calls these functions, add the config argument:

```tsx
const carryOverFromPreviousYear = isCurrentYear
  ? calculateCarryOver(records, selectedYear - 1, employmentStartDate, entitlement)
  : 0;
const stats = calculateYearlyStats(
  records,
  selectedYear,
  carryOverFromPreviousYear,
  employmentStartDate,
  entitlement
);
```

In `allocateDays`, replace `` const carryOverDeadlineStr = `${periodYear}-03-31`; `` with:

```tsx
const carryOverDeadlineStr = `${periodYear}-${entitlement.carryOverDeadline}`;
```

and its `calculateYearlyStats` call gets the `entitlement` arg appended too. Same for the JSX carry-over hint check: replace `` formEndDate <= `${selectedYear}-03-31` `` with `` formEndDate <= `${selectedYear}-${entitlement.carryOverDeadline}` ``.

- [ ] **Step 3: Rewrite handleAddRecord and handleDeleteRecord to use mutations**

```tsx
const handleAddRecord = async () => {
  if (!profile) return;
  if (!formStartDate || !formEndDate || formStartDate > formEndDate) {
    alert(t('alert.invalidDateRange'));
    return;
  }

  const totalWorkDays = countWorkDays(formStartDate, formEndDate, region);
  if (totalWorkDays === 0) {
    alert(t('alert.noWorkDays'));
    return;
  }

  const splitByYear = countWorkDaysByYear(formStartDate, formEndDate, region);
  const description = formDescription.trim();

  const newRecords: NewVacationRecord[] = [];
  const tempRecords = [...records];

  splitByYear.forEach((period) => {
    const alloc = allocateDays(period.days, period.endDate, period.year, tempRecords);

    if (alloc.carryover > 0) {
      newRecords.push({
        startDate: period.startDate,
        endDate: period.endDate,
        workDays: alloc.carryover,
        description,
        type: 'statutory',
        isCarryOver: true,
        year: period.year,
      });
    }
    if (alloc.contractual > 0) {
      newRecords.push({
        startDate: period.startDate,
        endDate: period.endDate,
        workDays: alloc.contractual,
        description,
        type: 'contractual',
        isCarryOver: false,
        year: period.year,
      });
    }
    if (alloc.statutory > 0) {
      newRecords.push({
        startDate: period.startDate,
        endDate: period.endDate,
        workDays: alloc.statutory,
        description,
        type: 'statutory',
        isCarryOver: false,
        year: period.year,
      });
    }

    // allocateDays 需要看到本次提交里已分配的记录
    tempRecords.push(
      ...newRecords
        .filter((r) => r.year === period.year)
        .map((r, i) => ({
          ...r,
          id: `temp-${i}`,
          userId: profile.id,
          createdAt: new Date().toISOString(),
        }))
    );
  });

  try {
    await createMutation.mutateAsync(newRecords);
    resetForm();
    setShowAddForm(false);
  } catch {
    showError(t('common.saveFailed'));
  }
};

const handleDeleteRecord = (id: string) => {
  if (confirm(t('alert.confirmDelete'))) {
    deleteMutation.mutate(id, {
      onError: () => showError(t('common.saveFailed')),
    });
  }
};
```

Note: `allocateDays` itself is unchanged except the deadline line from Step 2. The record-grouping display logic (the `dateMap`/`groups` IIFE in the JSX) also keys on `createdAt` — DB rows from one insert batch share a `created_at` close enough; change the group key to `` `${r.startDate}__${r.endDate}__${r.description}` `` to be robust against per-row timestamps.

- [ ] **Step 4: Add auth gating + view switch to the render**

At the top of the returned JSX (before `<div className="app">`), add early returns:

```tsx
if (authLoading) {
  return <div className="app-loading">{t('common.loading')}</div>;
}
if (!profile) {
  return <LoginPage />;
}
```

Replace the old `{showWelcome && ...}` welcome modal block with:

```tsx
{!profile.employmentStartDate && (
  <WelcomeModal
    onSubmit={(date) => {
      handleEmploymentDateSave(date);
      setLocale('en');
    }}
  />
)}
```

Replace the old settings modal block with:

```tsx
{showSettings && (
  <SettingsModal
    initialDate={employmentStartDate}
    onSave={handleEmploymentDateSave}
    onClose={() => setShowSettings(false)}
  />
)}
```

In the header controls (next to the existing settings button), add admin toggle + sign out:

```tsx
{isAdmin && (
  <button
    type="button"
    className="header-icon-btn"
    onClick={() => setView(view === 'admin' ? 'dashboard' : 'admin')}
    aria-label={t('nav.admin')}
    title={t('nav.admin')}
  >
    <Shield size={16} />
  </button>
)}
<button
  type="button"
  className="header-icon-btn"
  onClick={() => signOut()}
  aria-label={t('auth.signOut')}
  title={t('auth.signOut')}
>
  <LogOut size={16} />
</button>
```

Add `Shield, LogOut` to the lucide-react import.

Wrap the existing `<main>` content:

```tsx
{view === 'admin' && isAdmin ? (
  <AdminPanel />
) : (
  <main className="main" key={selectedYear}>
    {/* ...existing dashboard JSX unchanged... */}
  </main>
)}
```

The region `<select>`'s `onChange` becomes `onChange={(e) => handleRegionChange(e.target.value as RegionCode)}`.

Add loading/error handling for records right inside `<main>` before the stats grid:

```tsx
{recordsError && <div className="form-error">{t('common.loadFailed')}</div>}
{recordsLoading && <div className="app-loading">{t('common.loading')}</div>}
```

- [ ] **Step 5: Delete dead storage code from utils.ts**

Remove from `src/utils.ts`: `STORAGE_KEY`, `ALL_STORAGE_KEYS`, `BackupFile`, `exportAllData`, `importAllData`, `saveToStorage`, `loadFromStorage`, `migrateRecord`, and `generateId` (verify no remaining usages: `grep -rn "generateId\|saveToStorage\|loadFromStorage\|exportAllData\|importAllData\|ALL_STORAGE_KEYS" src/`).

- [ ] **Step 6: Add app-loading style to index.css** (append)

```css
.app-loading {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 40vh;
  color: #6b7280;
}
```

- [ ] **Step 7: Type-check and run tests**

Run: `npx tsc --noEmit && npm test`
Expected: clean compile EXCEPT the missing `AdminPanel` import (created next task). If you prefer a green checkpoint, temporarily stub it:

```tsx
// src/components/admin/AdminPanel.tsx (stub, replaced in Task 15)
export function AdminPanel() {
  return null;
}
```

- [ ] **Step 8: Manual smoke test**

Run: `npm run dev`
- Sign up as first user → profile created, role admin (check Supabase Dashboard → Table Editor → profiles).
- Welcome modal appears → save employment date → lands on dashboard.
- Add a vacation → appears in list; check the row exists in vacation_records.
- Delete it → gone from list and table.
- Change region → reload page → region persisted.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/utils.ts src/components/admin/AdminPanel.tsx src/index.css
git commit -m "feat: wire app to supabase - auth gate, db-backed records and profile"
```

---

### Task 15: Admin panel

**Files:**
- Create: `src/components/admin/UserTable.tsx`, `src/components/admin/UserRecordsModal.tsx`, `src/components/admin/SettingsCard.tsx`
- Replace stub: `src/components/admin/AdminPanel.tsx`

- [ ] **Step 1: Create `src/components/admin/SettingsCard.tsx`**

```tsx
import { useEffect, useState } from 'react';
import { useTranslation } from '../../i18n';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';
import { useToast } from '../Toast';

export function SettingsCard() {
  const { t } = useTranslation();
  const { data: settings } = useSettings();
  const updateMutation = useUpdateSettings();
  const { showError, showSuccess } = useToast();

  const [statutory, setStatutory] = useState('20');
  const [contractual, setContractual] = useState('8');
  const [deadline, setDeadline] = useState('03-31');

  useEffect(() => {
    if (settings) {
      setStatutory(String(settings.statutoryDays));
      setContractual(String(settings.contractualDays));
      setDeadline(settings.carryOverDeadline);
    }
  }, [settings]);

  const handleSave = async () => {
    const statutoryDays = Number(statutory);
    const contractualDays = Number(contractual);
    const valid =
      Number.isInteger(statutoryDays) &&
      statutoryDays >= 0 &&
      Number.isInteger(contractualDays) &&
      contractualDays >= 0 &&
      /^[0-1][0-9]-[0-3][0-9]$/.test(deadline);
    if (!valid) {
      showError(t('common.saveFailed'));
      return;
    }
    try {
      await updateMutation.mutateAsync({
        statutoryDays,
        contractualDays,
        carryOverDeadline: deadline,
      });
      showSuccess(t('admin.saved'));
    } catch {
      showError(t('common.saveFailed'));
    }
  };

  return (
    <div className="section">
      <h2>{t('admin.settingsTitle')}</h2>
      <div className="admin-settings-grid">
        <div className="form-group">
          <label>{t('admin.statutoryDays')}</label>
          <input
            type="number"
            min={0}
            value={statutory}
            onChange={(e) => setStatutory(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t('admin.contractualDays')}</label>
          <input
            type="number"
            min={0}
            value={contractual}
            onChange={(e) => setContractual(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label>{t('admin.carryOverDeadline')}</label>
          <input
            type="text"
            placeholder="03-31"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </div>
      </div>
      <button
        className="btn btn-primary"
        onClick={handleSave}
        disabled={updateMutation.isPending}
      >
        {t('admin.save')}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/components/admin/UserRecordsModal.tsx`**

```tsx
import { Trash2 } from 'lucide-react';
import { Profile, VacationRecord } from '../../types';
import { useTranslation } from '../../i18n';
import { formatDisplayDate } from '../../utils';
import { useDeleteVacation } from '../../hooks/useVacations';
import { useQueryClient } from '@tanstack/react-query';
import { useToast } from '../Toast';

interface UserRecordsModalProps {
  user: Profile;
  records: VacationRecord[];
  onClose: () => void;
}

export function UserRecordsModal({ user, records, onClose }: UserRecordsModalProps) {
  const { t } = useTranslation();
  const deleteMutation = useDeleteVacation(user.id);
  const queryClient = useQueryClient();
  const { showError } = useToast();

  const handleDelete = (id: string) => {
    if (!confirm(t('admin.confirmDeleteRecord'))) return;
    deleteMutation.mutate(id, {
      onSuccess: () =>
        queryClient.invalidateQueries({ queryKey: ['admin', 'vacations'] }),
      onError: () => showError(t('common.saveFailed')),
    });
  };

  const sorted = [...records].sort((a, b) => b.startDate.localeCompare(a.startDate));

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h2>{t('admin.recordsOf', { email: user.email })}</h2>
        {sorted.length === 0 ? (
          <p>{t('admin.noRecords')}</p>
        ) : (
          <div className="records-list">
            {sorted.map((record) => (
              <div key={record.id} className="record-card">
                <div className="record-row-main">
                  <div className="record-dates">
                    <span className="record-range">
                      {formatDisplayDate(record.startDate)}
                      {record.startDate !== record.endDate && (
                        <> — {formatDisplayDate(record.endDate)}</>
                      )}
                    </span>
                    <div className="record-tags">
                      <span className={`record-type ${record.isCarryOver ? 'carryover' : record.type}`}>
                        {record.type}
                      </span>
                      <span className="record-year">{record.year}</span>
                    </div>
                  </div>
                  <div className="record-info">
                    <span className="record-days">{record.workDays}d</span>
                    {record.description && (
                      <span className="record-desc">{record.description}</span>
                    )}
                  </div>
                  <button
                    className="record-delete"
                    onClick={() => handleDelete(record.id)}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            {t('modal.cancel')}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Create `src/components/admin/UserTable.tsx`**

```tsx
import { useState } from 'react';
import { Profile, VacationRecord } from '../../types';
import { useTranslation } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useSetUserActive, useSetUserRole } from '../../hooks/useAdmin';
import { useEntitlementConfig } from '../../hooks/useSettings';
import { calculateYearlyStats } from '../../utils';
import { useToast } from '../Toast';
import { UserRecordsModal } from './UserRecordsModal';

interface UserTableProps {
  users: Profile[];
  allRecords: VacationRecord[];
}

export function UserTable({ users, allRecords }: UserTableProps) {
  const { t } = useTranslation();
  const { profile: me } = useAuth();
  const entitlement = useEntitlementConfig();
  const setRoleMutation = useSetUserRole();
  const setActiveMutation = useSetUserActive();
  const { showError } = useToast();
  const [viewingUser, setViewingUser] = useState<Profile | null>(null);

  const year = new Date().getFullYear();
  const recordsByUser = new Map<string, VacationRecord[]>();
  for (const record of allRecords) {
    const list = recordsByUser.get(record.userId) ?? [];
    list.push(record);
    recordsByUser.set(record.userId, list);
  }

  const onError = () => showError(t('common.saveFailed'));

  return (
    <div className="section">
      <h2>{t('admin.usersTitle')}</h2>
      <table className="admin-table">
        <thead>
          <tr>
            <th>{t('admin.colEmail')}</th>
            <th>{t('admin.colName')}</th>
            <th>{t('admin.colRole')}</th>
            <th>{t('admin.colStatus')}</th>
            <th>{t('admin.colUsage')}</th>
            <th>{t('admin.colActions')}</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => {
            const userRecords = recordsByUser.get(user.id) ?? [];
            const stats = calculateYearlyStats(
              userRecords,
              year,
              0,
              user.employmentStartDate ?? undefined,
              entitlement
            );
            const used = stats.statutoryUsed + stats.contractualUsed;
            const total = stats.statutoryTotal + stats.contractualTotal;
            const isSelf = user.id === me?.id;
            return (
              <tr key={user.id} className={user.isActive ? '' : 'inactive-row'}>
                <td>{user.email}</td>
                <td>{user.displayName ?? '—'}</td>
                <td>{user.role === 'admin' ? t('admin.roleAdmin') : t('admin.roleUser')}</td>
                <td>{user.isActive ? t('admin.statusActive') : t('admin.statusInactive')}</td>
                <td>{t('admin.usageSummary', { used, total })}</td>
                <td className="admin-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => setViewingUser(user)}
                  >
                    {t('admin.viewRecords')}
                  </button>
                  {!isSelf && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setRoleMutation.mutate(
                            {
                              userId: user.id,
                              role: user.role === 'admin' ? 'user' : 'admin',
                            },
                            { onError }
                          )
                        }
                      >
                        {user.role === 'admin' ? t('admin.demote') : t('admin.promote')}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          setActiveMutation.mutate(
                            { userId: user.id, isActive: !user.isActive },
                            { onError }
                          )
                        }
                      >
                        {user.isActive ? t('admin.deactivate') : t('admin.activate')}
                      </button>
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {viewingUser && (
        <UserRecordsModal
          user={viewingUser}
          records={recordsByUser.get(viewingUser.id) ?? []}
          onClose={() => setViewingUser(null)}
        />
      )}
    </div>
  );
}
```

Note: self-demotion and self-deactivation are intentionally hidden (`!isSelf`) so the last admin can't lock everyone out.

- [ ] **Step 4: Replace the AdminPanel stub**

`src/components/admin/AdminPanel.tsx`:

```tsx
import { useTranslation } from '../../i18n';
import { useAuth } from '../../contexts/AuthContext';
import { useAdminUsers, useAdminVacations } from '../../hooks/useAdmin';
import { UserTable } from './UserTable';
import { SettingsCard } from './SettingsCard';

export function AdminPanel() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const usersQuery = useAdminUsers(isAdmin);
  const vacationsQuery = useAdminVacations(isAdmin);

  if (!isAdmin) return null;

  return (
    <main className="main">
      <h1 className="admin-heading">{t('admin.title')}</h1>
      {usersQuery.isLoading || vacationsQuery.isLoading ? (
        <div className="app-loading">{t('common.loading')}</div>
      ) : usersQuery.isError || vacationsQuery.isError ? (
        <div className="form-error">{t('common.loadFailed')}</div>
      ) : (
        <>
          <UserTable
            users={usersQuery.data ?? []}
            allRecords={vacationsQuery.data ?? []}
          />
          <SettingsCard />
        </>
      )}
    </main>
  );
}
```

- [ ] **Step 5: Add admin styles to index.css** (append)

```css
/* Admin panel */
.admin-heading { margin-bottom: 1rem; }
.admin-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}
.admin-table th,
.admin-table td {
  text-align: left;
  padding: 0.6rem 0.75rem;
  border-bottom: 1px solid #e5e7eb;
}
.admin-table .inactive-row { opacity: 0.5; }
.admin-actions { display: flex; gap: 0.25rem; flex-wrap: wrap; }
.btn-sm { padding: 0.25rem 0.5rem; font-size: 0.8rem; }
.admin-settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 1rem;
  margin-bottom: 1rem;
}
```

- [ ] **Step 6: Type-check, test, build**

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green.

- [ ] **Step 7: Manual admin smoke test**

- Sign up a SECOND user (different email, e.g. in an incognito window) → role is `user`.
- As the first (admin) user: shield icon appears → admin panel lists both users with usage stats.
- Promote/demote the second user → role chip updates.
- Deactivate the second user → their session: next reload shows deactivated message and sign-out.
- Edit global settings (e.g. statutory 25) → dashboard totals update for all users.
- As the second user: no shield icon; Supabase Table Editor confirms RLS (their queries return only own rows).

- [ ] **Step 8: Commit**

```bash
git add src/components/admin/ src/index.css
git commit -m "feat: add admin panel - user management and global settings"
```

---

### Task 16: Extract dashboard components from App.tsx

App.tsx still holds all dashboard JSX after Task 14. Extract it into focused components per the spec. This is mechanical movement of JSX that already exists — the blocks are identified by their JSX comments.

**Files:**
- Create: `src/components/dashboard/YearNav.tsx`, `src/components/dashboard/StatsCards.tsx`, `src/components/dashboard/RecordModal.tsx`, `src/components/dashboard/RecordList.tsx`
- Modify: `src/App.tsx`

- [ ] **Step 1: Create `src/components/dashboard/YearNav.tsx`**

```tsx
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface YearNavProps {
  year: number;
  onChange: (delta: number) => void;
}

export function YearNav({ year, onChange }: YearNavProps) {
  return (
    <div className="year-selector">
      <button className="year-btn" onClick={() => onChange(-1)}>
        <ChevronLeft size={20} />
      </button>
      <span className="year-display">{year}</span>
      <button className="year-btn" onClick={() => onChange(1)}>
        <ChevronRight size={20} />
      </button>
    </div>
  );
}
```

In App.tsx replace the `{/* 年份选择器 */}` block with `<YearNav year={selectedYear} onChange={handleYearChange} />`.

- [ ] **Step 2: Create `src/components/dashboard/StatsCards.tsx`**

Props interface:

```tsx
import { YearlyVacationStats } from '../../types';

interface StatsCardsProps {
  stats: YearlyVacationStats;
  carryOverFromPreviousYear: number;
}

export function StatsCards({ stats, carryOverFromPreviousYear }: StatsCardsProps) {
```

Move the ENTIRE `{/* 统计卡片 */}` block (the `<div className="stats-grid">…</div>` subtree) from App.tsx into this component's return. Inside the component compute the derived values the JSX uses:

```tsx
  const { t } = useTranslation();
  const yearlyTotal = stats.statutoryTotal + stats.contractualTotal;
  const totalUsed = stats.statutoryUsed + stats.contractualUsed;
  const totalRemaining = stats.statutoryRemaining + stats.contractualRemaining;
```

(Imports: `useTranslation` from `'../../i18n'`; `Sun, CheckCircle, AlertCircle` from `'lucide-react'`.) The JSX moves verbatim — no other identifier changes needed. In App.tsx replace the block with `<StatsCards stats={stats} carryOverFromPreviousYear={carryOverFromPreviousYear} />` and delete the now-unused `yearlyTotal`/`totalUsed`/`totalRemaining` locals.

- [ ] **Step 3: Create `src/components/dashboard/RecordModal.tsx`**

The add-vacation modal owns its form state; App keeps the allocation logic.

```tsx
import { useState } from 'react';
import { Info } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { RegionCode } from '../../regions';
import { countWorkDaysByYear, formatDisplayDate } from '../../utils';

interface RecordModalProps {
  region: RegionCode;
  selectedYear: number;
  carryOverFromPreviousYear: number;
  carryOverDeadline: string; // 'MM-DD'
  onSubmit: (startDate: string, endDate: string, description: string) => void;
  onClose: () => void;
}

export function RecordModal({
  region,
  selectedYear,
  carryOverFromPreviousYear,
  carryOverDeadline,
  onSubmit,
  onClose,
}: RecordModalProps) {
  const { t } = useTranslation();
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [description, setDescription] = useState('');

  const previewByYear =
    startDate && endDate && startDate <= endDate
      ? countWorkDaysByYear(startDate, endDate, region)
      : [];
  const previewWorkDays = previewByYear.reduce((sum, p) => sum + p.days, 0);
  const dash = t('modal.dash');
```

Move the `{/* 添加假期表单 */}` modal JSX from App.tsx into the return, with these renames: `formStartDate`→`startDate`, `formEndDate`→`endDate`, `formDescription`→`description`, `setShowAddForm(false)`→`onClose()`, `handleAddRecord`→`() => onSubmit(startDate, endDate, description)`, and the carry-over hint condition `` formEndDate <= `${selectedYear}-03-31` `` → `` endDate <= `${selectedYear}-${carryOverDeadline}` ``. The outer `{showAddForm && ...}` guard stays in App.tsx:

```tsx
{showAddForm && (
  <RecordModal
    region={region}
    selectedYear={selectedYear}
    carryOverFromPreviousYear={carryOverFromPreviousYear}
    carryOverDeadline={entitlement.carryOverDeadline}
    onSubmit={(start, end, desc) => handleAddRecord(start, end, desc)}
    onClose={() => setShowAddForm(false)}
  />
)}
```

Change `handleAddRecord` in App.tsx to take `(formStartDate: string, formEndDate: string, formDescription: string)` as parameters instead of reading state; on success call `setShowAddForm(false)` (the `resetForm` call and the form state in App.tsx are deleted — the modal owns them now).

- [ ] **Step 4: Create `src/components/dashboard/RecordList.tsx`**

```tsx
import { Trash2, Palmtree } from 'lucide-react';
import { useTranslation } from '../../i18n';
import { VacationRecord, YearlyVacationStats } from '../../types';
import { RegionCode } from '../../regions';
import { formatDisplayDate, formatShortDate, getWorkDayDates } from '../../utils';

interface RecordListProps {
  records: VacationRecord[]; // already filtered + sorted for the selected year
  region: RegionCode;
  stats: YearlyVacationStats;
  selectedYear: number;
  onDelete: (id: string) => void;
}

export function RecordList({
  records,
  region,
  stats,
  selectedYear,
  onDelete,
}: RecordListProps) {
  const { t } = useTranslation();
```

Move the ENTIRE `{/* 假期记录列表 */}` section (`<div className="section">` containing the records list, including the `dateMap`/`groups` IIFE) into the return, renaming `yearRecords`→`records` and `handleDeleteRecord`→`onDelete`. In App.tsx replace with:

```tsx
<RecordList
  records={yearRecords}
  region={region}
  stats={stats}
  selectedYear={selectedYear}
  onDelete={handleDeleteRecord}
/>
```

- [ ] **Step 5: Verify App.tsx is now a thin shell**

App.tsx should retain only: auth gate, header (language/region/admin/sign-out controls), view switch, `YearNav`/`StatsCards`/actions/`RecordModal`/holidays section/`RecordList`/rules sections composition, the `allocateDays` + `handleAddRecord` + `handleDeleteRecord` + `handleRegionChange` + `handleEmploymentDateSave` logic, and the modals. Target: under ~350 lines.

Run: `npx tsc --noEmit && npm test && npm run build`
Expected: all green.

- [ ] **Step 6: Manual smoke test**

`npm run dev` — add a record, delete a record, switch year, open holidays, open settings. All behaviors identical to before extraction.

- [ ] **Step 7: Commit**

```bash
git add src/App.tsx src/components/dashboard/
git commit -m "refactor: extract dashboard components from App.tsx"
```

---

### Task 17: CI and docs

**Files:**
- Modify: `.github/workflows/deploy.yml`, `README.md`

- [ ] **Step 1: Add env vars to the build step in deploy.yml**

Find the step that runs `npm run build` and add:

```yaml
        env:
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
```

- [ ] **Step 2: Add the secrets in GitHub**

Repo → Settings → Secrets and variables → Actions → add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`. (Manual step — note it for the user.)

- [ ] **Step 3: Add a test job step before build (optional but recommended)**

In the build job, after `npm ci`, add:

```yaml
      - name: Run tests
        run: npm test
```

Note: `npm test` runs vitest which imports `src/lib/supabase.ts` indirectly — the mapping tests do import the supabase client module. In CI without env vars the import throws. Two options: (a) pass the same env block to the test step, or (b) keep mapping functions importable without the client by NOT importing `supabase` at module top-level in test files (the tests only import `rowToRecord`/`recordToRow`, but `vacations.ts` imports supabase at top). Simplest: add the env block to the test step too.

- [ ] **Step 4: Update README.md**

Replace the storage/backup sections with: Supabase setup (create project → run `supabase/migrations/001_initial_schema.sql` → copy `.env.example` to `.env` → fill credentials), auth model (open signup, first user = admin), admin capabilities list, and local dev (`npm install && npm run dev`). Remove mentions of localStorage persistence and backup/restore.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/deploy.yml README.md
git commit -m "ci: inject supabase env vars; document supabase setup"
```

---

### Task 18: RLS verification (manual gate)

- [ ] **Step 1: Run `supabase/tests/rls_checks.sql`**

With two real users created (Tasks 14/15 smoke tests), replace the UUID placeholders and run each block in the Supabase SQL editor.

Expected results per block:
1. `own_profile_count` = 1
2. single distinct `user_id` (the normal user's)
3. ERROR (insert for someone else rejected)
4. `statutory_days` unchanged
5. ERROR (`only admins may change role or active status`)
6. `all_profiles_count` = total users

If ANY check deviates, STOP and fix the policies before proceeding.

---

### Task 19: Final verification

- [ ] **Step 1: Full local verification**

```bash
npx tsc --noEmit && npm test && npm run build
```

Expected: zero errors, all tests pass, build succeeds.

- [ ] **Step 2: Full manual pass (both users)**

- Login/logout both users.
- Add a multi-year vacation (e.g. Dec 28 – Jan 5) → splits into per-year records correctly.
- Carry-over allocation: with remaining days from previous year, vacation before the deadline consumes carry-over first.
- Language switch persists across reload; region/employment date persist via DB.
- Admin: all features from Task 15 Step 7.

- [ ] **Step 3: Push and verify deploy**

```bash
git push origin database_integration
```

Open a PR to main when satisfied; after merge, confirm the GitHub Pages build gets the env secrets and the deployed app connects to Supabase.

---

## Post-plan notes

- **Last-admin lockout:** UI hides self-demote/self-deactivate. DB-level guard (refusing to demote the final admin) deliberately omitted — YAGNI for a personal tool; revisit if user count grows.
- **Optimistic create** was simplified to invalidate-on-success because batch inserts return server-generated IDs the grouping logic needs; delete remains optimistic.
- **supabase CLI type generation** (`supabase gen types typescript`) can replace the hand-written row interfaces later; not required now.
