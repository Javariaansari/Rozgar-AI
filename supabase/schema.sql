-- Rozgar AI Database Schema
-- Run this entire file in Supabase SQL Editor: https://supabase.com/dashboard/project/_/sql/new

-- Profiles table (extends auth.users)
create table profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text,
  phone text,
  role text check (role in ('worker', 'customer')) not null,
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
  cnic_verified boolean default false,
  ai_skill_score jsonb default '{}'
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
  status text default 'open' check (status in ('open', 'in_progress', 'completed', 'cancelled')),
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

-- ============================================================
-- Auto-create profile on signup
-- ============================================================
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

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

-- Profiles: users can read all, update own
create policy "Public profiles readable" on profiles for select using (true);
create policy "Users update own profile" on profiles for update using (auth.uid() = id);

-- Worker profiles: readable by all, editable by owner
create policy "Worker profiles readable" on worker_profiles for select using (true);
create policy "Workers update own" on worker_profiles for update using (auth.uid() = user_id);
create policy "Workers insert own" on worker_profiles for insert with check (auth.uid() = user_id);

-- Customer profiles: readable by all, editable by owner
create policy "Customer profiles readable" on customer_profiles for select using (true);
create policy "Customers update own" on customer_profiles for update using (auth.uid() = user_id);
create policy "Customers insert own" on customer_profiles for insert with check (auth.uid() = user_id);

-- Jobs: readable by all, customers manage own
create policy "Jobs readable" on jobs for select using (true);
create policy "Customers manage own jobs" on jobs for all using (auth.uid() = customer_id);

-- Applications: workers see own, customers see for their jobs
create policy "Workers see own applications" on applications for select using (auth.uid() = worker_id);
create policy "Customers see applicants" on applications for select using (
  exists (select 1 from jobs where jobs.id = applications.job_id and jobs.customer_id = auth.uid())
);
create policy "Workers apply" on applications for insert with check (auth.uid() = worker_id);
create policy "Customers update applications" on applications for update using (
  exists (select 1 from jobs where jobs.id = applications.job_id and jobs.customer_id = auth.uid())
);

-- AI matches: readable by job owner and matched worker
create policy "Matched users see matches" on ai_matches for select using (
  auth.uid() = worker_id or exists (select 1 from jobs where jobs.id = ai_matches.job_id and jobs.customer_id = auth.uid())
);

-- Ratings: readable by all, insert by authenticated users involved in job
create policy "Ratings readable" on ratings for select using (true);
create policy "Users insert own ratings" on ratings for insert with check (auth.uid() = from_user_id);

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
