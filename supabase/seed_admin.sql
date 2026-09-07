-- Seed the first admin account
-- 1) Create the account first via /signup or the Supabase Dashboard.
-- 2) Replace 'admin@rozgar.ai' with the real admin email.
-- 3) Run this in the Supabase SQL Editor.

update public.profiles p
set role = 'admin', email = u.email
from auth.users u
where u.id = p.id and u.email = 'admin@rozgar.ai';

-- remove the worker profile row the signup trigger created for this account
delete from public.worker_profiles
where user_id in (select id from public.profiles where role = 'admin');
