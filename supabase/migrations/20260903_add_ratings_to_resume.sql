-- Add rating stats to worker_profiles so ratings auto-update the resume
alter table public.worker_profiles
add column if not exists average_rating numeric,
add column if not exists total_reviews int default 0;

-- Recalculate a worker's average rating and review count
-- Runs as security definer so it can update worker_profiles even when triggered by a customer rating
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

-- Keep worker_profiles in sync whenever a rating is inserted, updated, or deleted
drop trigger if exists on_rating_changed on public.ratings;
create trigger on_rating_changed
after insert or update or delete on public.ratings
for each row execute function public.update_worker_rating_stats();

-- Backfill stats for existing ratings
update public.worker_profiles
set
  average_rating = sub.avg_stars,
  total_reviews = sub.review_count
from (
  select to_user_id, round(avg(stars)::numeric, 2) as avg_stars, count(*) as review_count
  from public.ratings
  group by to_user_id
) sub
where public.worker_profiles.user_id = sub.to_user_id;
