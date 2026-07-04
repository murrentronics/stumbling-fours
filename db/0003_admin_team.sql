-- =====================================================================
-- Stumbling Fours — Admin team + remove admins from player teams
-- Run in Supabase SQL editor after 0002_teams_and_realtime.sql
-- =====================================================================

-- ---------- 1. Remove all admins from roster_team_members -------------
-- Admins are not players and should never appear in player team rosters.
delete from public.roster_team_members
where user_id in (
  select user_id from public.user_roles where role = 'admin'
);

-- ---------- 2. Create the Admin team (idempotent) ---------------------
insert into public.roster_teams (name, color)
values ('Admin', 'team-p')   -- team-p = Slate, neutral colour
on conflict (name) do nothing;

-- ---------- 3. Add all admin users into the Admin team ----------------
insert into public.roster_team_members (team_id, user_id, display_name, email)
select
  rt.id,
  p.id,
  coalesce(p.display_name, split_part(p.email, '@', 1)),
  p.email
from public.roster_teams rt
cross join (
  select pr.id, pr.email, pr.display_name
  from public.profiles pr
  inner join public.user_roles ur on ur.user_id = pr.id
  where ur.role = 'admin'
) p
where rt.name = 'Admin'
on conflict (team_id, user_id) do nothing;

-- ---------- 4. Trigger: keep Admin team in sync on role changes -------
-- When a user is promoted to admin:  add to Admin team, remove from player teams.
-- When a user is demoted (role deleted): remove from Admin team.

create or replace function public.sync_admin_team()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  admin_team_id uuid;
begin
  -- Resolve the Admin team id (created above)
  select id into admin_team_id from public.roster_teams where name = 'Admin';

  if admin_team_id is null then
    return coalesce(new, old);
  end if;

  if TG_OP = 'INSERT' and new.role = 'admin' then
    -- Remove from all player teams
    delete from public.roster_team_members
    where user_id = new.user_id
      and team_id <> admin_team_id;

    -- Add to Admin team
    insert into public.roster_team_members (team_id, user_id, display_name, email)
    select
      admin_team_id,
      p.id,
      coalesce(p.display_name, split_part(p.email, '@', 1)),
      p.email
    from public.profiles p
    where p.id = new.user_id
    on conflict (team_id, user_id) do nothing;

  elsif TG_OP = 'DELETE' and old.role = 'admin' then
    -- Demoted — remove from Admin team
    delete from public.roster_team_members
    where user_id = old.user_id
      and team_id = admin_team_id;
  end if;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_sync_admin_team on public.user_roles;
create trigger trg_sync_admin_team
after insert or delete on public.user_roles
for each row execute function public.sync_admin_team();
