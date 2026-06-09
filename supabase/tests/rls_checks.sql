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
