-- Phone number requirement
-- Ensures the signup trigger stores phone from auth metadata.
-- Run in Supabase SQL Editor. Safe to re-run.

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
