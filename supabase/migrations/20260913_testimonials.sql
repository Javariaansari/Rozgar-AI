-- Testimonials / public reviews submitted by customers and workers
-- Run this in Supabase SQL Editor

create table public.testimonials (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  role text check (role in ('customer', 'worker')) not null,
  content text not null,
  stars int check (stars between 1 and 5),
  is_approved boolean not null default false,
  voice_transcript text,
  created_at timestamptz default now()
);

create index testimonials_approved_idx on public.testimonials (is_approved, created_at desc);
create index testimonials_user_id_idx on public.testimonials (user_id);

-- Public can read approved testimonials; authenticated users can insert own
alter table public.testimonials enable row level security;

create policy "Approved testimonials readable" on public.testimonials for select using (is_approved = true);
create policy "Users insert own testimonials" on public.testimonials for insert with check (auth.uid() = user_id);
create policy "Users update own testimonials" on public.testimonials for update using (auth.uid() = user_id);
create policy "Admins manage testimonials" on public.testimonials for all using (public.is_admin()) with check (public.is_admin());
