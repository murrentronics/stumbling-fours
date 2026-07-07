-- =====================================================================
-- Stumbling Fours — Fix game_snapshot so admin can delete tournaments
-- Run in Supabase SQL editor
-- =====================================================================

-- The game_snapshot table holds the entire app state as a single JSONB
-- blob (id=1). Deleting a past tournament = pushing a new snapshot with
-- those matches removed. This migration ensures:
--   1. The row exists
--   2. Any authenticated user (especially admin) can upsert it
--   3. Realtime is publishing the table so all clients get the update

-- ---------- 1. Ensure the row exists ---------------------------------
insert into public.game_snapshot (id, data)
values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- ---------- 2. Drop and recreate write policy clearly ----------------
drop policy if exists "auth write snapshot" on public.game_snapshot;
drop policy if exists "authenticated write snapshot" on public.game_snapshot;

create policy "authenticated write snapshot"
on public.game_snapshot
for all
to authenticated
using (true)
with check (true);

-- ---------- 3. Ensure select policy exists ---------------------------
drop policy if exists "snapshot readable" on public.game_snapshot;

create policy "snapshot readable"
on public.game_snapshot
for select
using (true);

-- ---------- 4. Grant insert+update to authenticated ------------------
grant select, insert, update on public.game_snapshot to authenticated;

-- ---------- 5. REPLICA IDENTITY FULL so realtime sends full rows -----
alter table public.game_snapshot replica identity full;

-- ---------- 6. Ensure in realtime publication ------------------------
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and tablename = 'game_snapshot'
  ) then
    alter publication supabase_realtime add table public.game_snapshot;
  end if;
end;
$$;

-- ---------- 7. Confirm current snapshot size -------------------------
select
  id,
  updated_at,
  jsonb_array_length(data->'matches') as match_count,
  case when data->'tournament' is null then 'none' else data->>'tournament' end as tournament
from public.game_snapshot
where id = 1;
