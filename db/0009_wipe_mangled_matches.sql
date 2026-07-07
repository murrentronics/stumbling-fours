-- =====================================================================
-- Stumbling Fours — Wipe all completed matches from the snapshot
-- This clears the mangled/duplicate tournament records from the Past tab
-- Run in Supabase SQL editor
-- =====================================================================

-- Preview what we're about to remove (run this SELECT first to confirm)
select
  jsonb_array_length(data->'matches') as total_matches,
  (
    select count(*)
    from jsonb_array_elements(data->'matches') as m
    where m->>'status' = 'completed'
  ) as completed_matches,
  (
    select count(*)
    from jsonb_array_elements(data->'matches') as m
    where m->>'status' != 'completed'
  ) as live_or_scheduled_matches
from public.game_snapshot
where id = 1;

-- ── WIPE: remove only completed matches, keep live/scheduled ones ────
update public.game_snapshot
set
  data = jsonb_set(
    data,
    '{matches}',
    coalesce(
      (
        select jsonb_agg(m)
        from jsonb_array_elements(data->'matches') as m
        where m->>'status' != 'completed'
      ),
      '[]'::jsonb
    )
  ),
  updated_at = now()
where id = 1;

-- Confirm the result
select
  jsonb_array_length(data->'matches') as matches_remaining,
  updated_at
from public.game_snapshot
where id = 1;
