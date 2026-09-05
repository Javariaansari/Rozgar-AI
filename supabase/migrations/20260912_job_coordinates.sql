-- Add optional coordinate columns to jobs for map-based location selection
alter table public.jobs add column if not exists latitude double precision;
alter table public.jobs add column if not exists longitude double precision;
