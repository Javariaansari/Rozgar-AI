-- Admin Panel MVP
-- Run in Supabase SQL Editor. Safe to re-run.

-- 1. profiles: contact + moderation fields, widen role check
alter table public.profiles
  add column if not exists email text,
  add column if not exists is_banned boolean not null default false,
  add column if not exists banned_at timestamptz,
  add column if not exists ban_reason text;

alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles
  add constraint profiles_role_check check (role in ('worker', 'customer', 'admin'));

create index if not exists profiles_role_idx on public.profiles (role);
create index if not exists profiles_email_idx on public.profiles (email);
create index if not exists profiles_created_at_idx on public.profiles (created_at desc);

-- backfill email from auth.users
update public.profiles p
set email = u.email
from auth.users u
where u.id = p.id and p.email is distinct from u.email;

-- 2. hardened signup trigger: never allow self-assigned 'admin', keep email in sync
-- drop first so we can replace the return type signature cleanly
drop trigger if exists on_auth_user_created on auth.users;

create or replace function public.handle_new_user()
returns trigger as $$
declare
  requested_role text;
  safe_role text;
begin
  requested_role := new.raw_user_meta_data->>'role';
  -- client-controlled metadata can never become admin
  safe_role := case when requested_role in ('worker', 'customer') then requested_role else 'worker' end;

  insert into public.profiles (id, role, email, phone)
  values (new.id, safe_role, new.email, new.raw_user_meta_data->>'phone')
  on conflict (id) do update set email = excluded.email, phone = excluded.phone;

  if safe_role = 'worker' then
    insert into public.worker_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  elsif safe_role = 'customer' then
    insert into public.customer_profiles (user_id) values (new.id) on conflict (user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 3. worker_profiles: store CNIC document + verification audit
alter table public.worker_profiles
  add column if not exists cnic_url text,
  add column if not exists cnic_verified_at timestamptz,
  add column if not exists cnic_verified_by uuid references public.profiles(id) on delete set null;

-- 4. jobs: moderation flags
alter table public.jobs
  add column if not exists is_flagged boolean not null default false,
  add column if not exists flag_reason text,
  add column if not exists flagged_at timestamptz,
  add column if not exists flagged_by uuid references public.profiles(id) on delete set null;

create index if not exists jobs_status_idx on public.jobs (status);
create index if not exists jobs_is_flagged_idx on public.jobs (is_flagged);
create index if not exists jobs_created_at_idx on public.jobs (created_at desc);

-- 5. disputes
create table if not exists public.disputes (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references public.jobs(id) on delete cascade,
  raised_by uuid references public.profiles(id) on delete cascade not null,
  against_user_id uuid references public.profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open'
    check (status in ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid references public.profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists disputes_status_idx on public.disputes (status);
create index if not exists disputes_created_at_idx on public.disputes (created_at desc);
alter table public.disputes enable row level security;

-- 6. admin action audit log
create table if not exists public.admin_actions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references public.profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb default '{}',
  created_at timestamptz default now()
);

create index if not exists admin_actions_created_at_idx on public.admin_actions (created_at desc);
alter table public.admin_actions enable row level security;

-- 7. is_admin() helper (security definer -> no RLS recursion)
create or replace function public.is_admin(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.profiles p where p.id = uid and p.role = 'admin');
$$;

grant execute on function public.is_admin(uuid) to authenticated;

-- 8. RLS policies
drop policy if exists "Admins update any profile" on public.profiles;
create policy "Admins update any profile" on public.profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins delete any profile" on public.profiles;
create policy "Admins delete any profile" on public.profiles
  for delete using (public.is_admin());

drop policy if exists "Admins update worker profiles" on public.worker_profiles;
create policy "Admins update worker profiles" on public.worker_profiles
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins manage all jobs" on public.jobs;
create policy "Admins manage all jobs" on public.jobs
  for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read all applications" on public.applications;
create policy "Admins read all applications" on public.applications
  for select using (public.is_admin());

drop policy if exists "Admins delete ratings" on public.ratings;
create policy "Admins delete ratings" on public.ratings
  for delete using (public.is_admin());

drop policy if exists "Users read own disputes" on public.disputes;
create policy "Users read own disputes" on public.disputes
  for select using (auth.uid() = raised_by or auth.uid() = against_user_id);

drop policy if exists "Users raise own disputes" on public.disputes;
create policy "Users raise own disputes" on public.disputes
  for insert with check (auth.uid() = raised_by);

drop policy if exists "Admins read all disputes" on public.disputes;
create policy "Admins read all disputes" on public.disputes
  for select using (public.is_admin());

drop policy if exists "Admins update disputes" on public.disputes;
create policy "Admins update disputes" on public.disputes
  for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists "Admins read audit log" on public.admin_actions;
create policy "Admins read audit log" on public.admin_actions
  for select using (public.is_admin());
