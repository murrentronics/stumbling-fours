-- =====================================================================
-- Stumbling Fours — Teams roster + realtime snapshot
-- Run in Supabase SQL editor after 0001_stumbling_fours_init.sql
-- =====================================================================

-- ---------- ROSTER TEAMS (persistent, cross-tournament) ---------------
create table if not exists public.roster_teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  color text not null default 'team-a',
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select on public.roster_teams to anon, authenticated;
grant insert, update, delete on public.roster_teams to authenticated;
grant all on public.roster_teams to service_role;

alter table public.roster_teams enable row level security;

drop policy if exists "roster_teams readable" on public.roster_teams;
create policy "roster_teams readable" on public.roster_teams
  for select using (true);

drop policy if exists "admins write roster_teams" on public.roster_teams;
create policy "admins write roster_teams" on public.roster_teams
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- ---------- ROSTER MEMBERS -------------------------------------------
create table if not exists public.roster_team_members (
  team_id uuid references public.roster_teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  display_name text not null,
  email text,
  primary key (team_id, user_id)
);

grant select on public.roster_team_members to anon, authenticated;
grant insert, update, delete on public.roster_team_members to authenticated;
grant all on public.roster_team_members to service_role;

alter table public.roster_team_members enable row level security;

drop policy if exists "roster_members readable" on public.roster_team_members;
create policy "roster_members readable" on public.roster_team_members
  for select using (true);

drop policy if exists "admins write roster_members" on public.roster_team_members;
create policy "admins write roster_members" on public.roster_team_members
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Users may join/leave their OWN membership (used at signup)
drop policy if exists "users insert own membership" on public.roster_team_members;
create policy "users insert own membership" on public.roster_team_members
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users delete own membership" on public.roster_team_members;
create policy "users delete own membership" on public.roster_team_members
  for delete to authenticated
  using (user_id = auth.uid());

-- RPC: set the caller's current team (removes prior memberships)
create or replace function public.set_my_team(_team_id uuid)
returns void language plpgsql security definer set search_path = public
as $$
declare
  dname text;
  em text;
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;

  select display_name, email into dname, em
  from public.profiles where id = auth.uid();

  delete from public.roster_team_members where user_id = auth.uid();

  if _team_id is not null then
    insert into public.roster_team_members (team_id, user_id, display_name, email)
    values (_team_id, auth.uid(), coalesce(dname, split_part(em, '@', 1)), em);
  end if;
end;
$$;

grant execute on function public.set_my_team(uuid) to authenticated;

-- ---------- GAME SNAPSHOT (single realtime blob) ---------------------
create table if not exists public.game_snapshot (
  id int primary key check (id = 1),
  data jsonb not null default '{}'::jsonb,
  updated_by uuid references auth.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

grant select on public.game_snapshot to anon, authenticated;
grant insert, update on public.game_snapshot to authenticated;
grant all on public.game_snapshot to service_role;

alter table public.game_snapshot enable row level security;

drop policy if exists "snapshot readable" on public.game_snapshot;
create policy "snapshot readable" on public.game_snapshot
  for select using (true);

-- Any signed-in user can write the snapshot (players submit rounds, admins
-- manage matches). App-level logic gates who can do what.
drop policy if exists "auth write snapshot" on public.game_snapshot;
create policy "auth write snapshot" on public.game_snapshot
  for all to authenticated using (true) with check (true);

insert into public.game_snapshot (id, data) values (1, '{}'::jsonb)
on conflict (id) do nothing;

-- Realtime
alter publication supabase_realtime add table public.roster_teams;
alter publication supabase_realtime add table public.roster_team_members;
alter publication supabase_realtime add table public.game_snapshot;
