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
