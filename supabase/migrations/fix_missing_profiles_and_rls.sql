-- Safe migration: fix missing RLS policy, trigger, and backfill existing users
-- Run this in Supabase SQL Editor

-- 1. Add missing INSERT policy for profiles (drop first to avoid duplicate errors)
drop policy if exists "Users insert own profile" on profiles;
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);

-- 2. Ensure trigger function is up-to-date
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, role)
  values (new.id, coalesce(new.raw_user_meta_data->>'role', 'worker'));

  if coalesce(new.raw_user_meta_data->>'role', 'worker') = 'worker' then
    insert into public.worker_profiles (user_id) values (new.id);
  else
    insert into public.customer_profiles (user_id) values (new.id);
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- 3. Ensure trigger exists
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Backfill profiles for existing auth.users that don't have one
insert into public.profiles (id, role)
select
  auth.users.id,
  coalesce(auth.users.raw_user_meta_data->>'role', 'worker')
from auth.users
where not exists (
  select 1 from public.profiles where public.profiles.id = auth.users.id
);

-- 5. Backfill missing worker_profiles for worker roles
insert into public.worker_profiles (user_id)
select p.id
from public.profiles p
where p.role = 'worker'
  and not exists (
    select 1 from public.worker_profiles wp where wp.user_id = p.id
  );

-- 6. Backfill missing customer_profiles for customer roles
insert into public.customer_profiles (user_id)
select p.id
from public.profiles p
where p.role = 'customer'
  and not exists (
    select 1 from public.customer_profiles cp where cp.user_id = p.id
  );
