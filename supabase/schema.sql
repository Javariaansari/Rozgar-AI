-- Rozgar AI Database Schema
-- Run this entire file in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  phone text,
  email text,
  role text check (role in ('worker', 'customer', 'admin')) not null,
  is_banned boolean not null default false,
  banned_at timestamptz,
  ban_reason text,
  created_at timestamptz default now()
);

-- Worker profiles
create table worker_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null unique,
  skills text[] default '{}',
  bio text,
  voice_transcript text,
  experience_years int,
  location text,
  profile_pic_url text,
  cnic_url text,
  cnic_verified boolean default false,
  cnic_verified_at timestamptz,
  cnic_verified_by uuid references profiles(id) on delete set null,
  ai_skill_score jsonb default '{}',
  average_rating numeric,
  total_reviews int default 0
);

-- Customer profiles
create table customer_profiles (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references profiles(id) on delete cascade not null unique,
  company_name text,
  address text
);

-- Jobs
create table jobs (
  id uuid default gen_random_uuid() primary key,
  customer_id uuid references profiles(id) on delete cascade not null,
  title text not null,
  description text,
  category text,
  budget numeric,
  location text,
  latitude double precision,
  longitude double precision,
  status text default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
  is_flagged boolean not null default false,
  flag_reason text,
  flagged_at timestamptz,
  flagged_by uuid references profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- Applications
create table applications (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade not null,
  worker_id uuid references profiles(id) on delete cascade not null,
  status text default 'applied' check (status in ('applied', 'selected', 'rejected')),
  applied_at timestamptz default now()
);

-- AI Matches
create table ai_matches (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade not null,
  worker_id uuid references profiles(id) on delete cascade not null,
  match_score numeric,
  reasoning text,
  created_at timestamptz default now()
);

-- Ratings
create table ratings (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade not null,
  from_user_id uuid references profiles(id) not null,
  to_user_id uuid references profiles(id) not null,
  stars int check (stars between 1 and 5),
  review_text text,
  created_at timestamptz default now()
);

-- Disputes
create table disputes (
  id uuid default gen_random_uuid() primary key,
  job_id uuid references jobs(id) on delete cascade,
  raised_by uuid references profiles(id) on delete cascade not null,
  against_user_id uuid references profiles(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open', 'under_review', 'resolved', 'rejected')),
  resolution_note text,
  resolved_by uuid references profiles(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Admin action audit log
create table admin_actions (
  id uuid default gen_random_uuid() primary key,
  admin_id uuid references profiles(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  details jsonb default '{}',
  created_at timestamptz default now()
);

-- ============================================================
-- Indexes
-- ============================================================
create index profiles_role_idx on public.profiles (role);
create index profiles_email_idx on public.profiles (email);
create index profiles_created_at_idx on public.profiles (created_at desc);
create index jobs_status_idx on public.jobs (status);
create index jobs_is_flagged_idx on public.jobs (is_flagged);
create index jobs_created_at_idx on public.jobs (created_at desc);
create index disputes_status_idx on public.disputes (status);
create index disputes_created_at_idx on public.disputes (created_at desc);
create index admin_actions_created_at_idx on public.admin_actions (created_at desc);

-- ============================================================
-- Auto-update worker resume rating stats when a rating changes
-- ============================================================
create or replace function public.update_worker_rating_stats()
returns trigger as $$
declare
  target_user_id uuid;
begin
  if TG_OP = 'DELETE' then
    target_user_id := OLD.to_user_id;
  else
    target_user_id := NEW.to_user_id;
  end if;

  update public.worker_profiles
  set
    average_rating = (
      select round(avg(stars)::numeric, 2)
      from public.ratings
      where to_user_id = target_user_id
    ),
    total_reviews = (
      select count(*)
      from public.ratings
      where to_user_id = target_user_id
    )
  where user_id = target_user_id;

  return null;
end;
$$ language plpgsql security definer;

drop trigger if exists on_rating_changed on public.ratings;
create trigger on_rating_changed
after insert or update or delete on public.ratings
for each row execute function public.update_worker_rating_stats();

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
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

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- Admin helper
-- ============================================================
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

-- ============================================================
-- Row Level Security
-- ============================================================
alter table profiles enable row level security;
alter table worker_profiles enable row level security;
alter table customer_profiles enable row level security;
alter table jobs enable row level security;
alter table applications enable row level security;
alter table ai_matches enable row level security;
alter table ratings enable row level security;
alter table disputes enable row level security;
alter table admin_actions enable row level security;

-- Profiles: users can read all, insert/update own; admins can update/delete any
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users insert own profile" on profiles for insert with check (auth.uid() = id);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);
create policy "Admins update any profile" on profiles
  for update using (public.is_admin()) with check (public.is_admin());
create policy "Admins delete any profile" on profiles
  for delete using (public.is_admin());

-- Worker profiles: readable by all, editable by owner or admin
create policy "Worker profiles readable" on worker_profiles for select using (true);
create policy "Workers update own" on worker_profiles for update using (auth.uid() = user_id);
create policy "Workers insert own" on worker_profiles for insert with check (auth.uid() = user_id);
create policy "Admins update worker profiles" on worker_profiles
  for update using (public.is_admin()) with check (public.is_admin());

-- Customer profiles: readable by all, editable by owner
create policy "Customer profiles readable" on customer_profiles for select using (true);
create policy "Customers update own" on customer_profiles for update using (auth.uid() = user_id);
create policy "Customers insert own" on customer_profiles for insert with check (auth.uid() = user_id);

-- Jobs: readable by all, customers manage own, admins manage all
create policy "Jobs readable" on jobs for select using (true);
create policy "Customers manage own jobs" on jobs for all using (auth.uid() = customer_id);
create policy "Admins manage all jobs" on jobs
  for all using (public.is_admin()) with check (public.is_admin());

-- Applications: workers see own, customers see for their jobs, admins see all
create policy "Workers see own applications" on applications for select using (auth.uid() = worker_id);
create policy "Customers see applicants" on applications for select using (
  exists (select 1 from jobs where jobs.id = applications.job_id and jobs.customer_id = auth.uid())
);
create policy "Workers apply" on applications for insert with check (auth.uid() = worker_id);
create policy "Customers update applications" on applications for update using (
  exists (select 1 from jobs where jobs.id = applications.job_id and jobs.customer_id = auth.uid())
);
create policy "Admins read all applications" on applications
  for select using (public.is_admin());

-- AI matches: readable by job owner and matched worker
create policy "Matched users see matches" on ai_matches for select using (
  auth.uid() = worker_id or exists (select 1 from jobs where jobs.id = ai_matches.job_id and jobs.customer_id = auth.uid())
);

-- Ratings: readable by all, insert by authenticated users; admins can delete
create policy "Ratings readable" on ratings for select using (true);
create policy "Users insert own ratings" on ratings for insert with check (auth.uid() = from_user_id);
create policy "Admins delete ratings" on ratings
  for delete using (public.is_admin());

-- Disputes
create policy "Users read own disputes" on disputes
  for select using (auth.uid() = raised_by or auth.uid() = against_user_id);
create policy "Users raise own disputes" on disputes
  for insert with check (auth.uid() = raised_by);
create policy "Admins read all disputes" on disputes
  for select using (public.is_admin());
create policy "Admins update disputes" on disputes
  for update using (public.is_admin()) with check (public.is_admin());

-- Admin audit log
create policy "Admins read audit log" on admin_actions
  for select using (public.is_admin());

-- ============================================================
-- Storage: worker-documents bucket
-- Run this in Supabase dashboard or SQL editor after the above
-- ============================================================
insert into storage.buckets (id, name, public)
values ('worker-documents', 'worker-documents', true)
on conflict (id) do nothing;

-- Workers can upload their own files
create policy "Workers upload own documents"
  on storage.objects for insert
  with check (bucket_id = 'worker-documents' and auth.uid()::text = (storage.foldername(name))[1]);

-- Anyone can read (public bucket for profile pics)
create policy "Public read access"
  on storage.objects for select
  using (bucket_id = 'worker-documents');
