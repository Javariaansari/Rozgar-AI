-- Idempotent migration: add resume fields to existing worker_profiles
alter table worker_profiles
  add column if not exists experience_years int,
  add column if not exists location text;
