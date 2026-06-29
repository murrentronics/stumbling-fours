-- =====================================================================
-- Stumbling Fours — initial schema
-- Run this in the Supabase SQL editor of project iiafmwsjvduswcmmsurz
-- =====================================================================

-- ---------- ROLES -----------------------------------------------------
create type public.app_role as enum ('admin', 'player');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);

grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;

alter table public.user_roles enable row level security;

create policy "users can read own roles"
on public.user_roles for select to authenticated
using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.user_roles
    where user_id = _user_id and role = _role
  );
$$;

-- ---------- PROFILES --------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant select, insert, update on public.profiles to authenticated;
grant all on public.profiles to service_role;

alter table public.profiles enable row level security;

create policy "profiles readable by signed-in users"
on public.profiles for select to authenticated using (true);

create policy "users update own profile"
on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- Trigger: create profile + first-admin grant on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));

  -- First admin: theronmurren@gfmail.com
  if lower(new.email) = 'theronmurren@gfmail.com' then
    insert into public.user_roles (user_id, role) values (new.id, 'admin')
    on conflict do nothing;
  else
    insert into public.user_roles (user_id, role) values (new.id, 'player')
    on conflict do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Admin-only: promote a registered user to admin by email
create or replace function public.promote_to_admin(_email text)
returns table (user_id uuid, email text)
language plpgsql security definer set search_path = public
as $$
declare
  target_id uuid;
begin
  if not public.has_role(auth.uid(), 'admin') then
    raise exception 'forbidden: admin role required';
  end if;

  select id into target_id from public.profiles
  where lower(profiles.email) = lower(_email);
  if target_id is null then
    raise exception 'no registered user with email %', _email;
  end if;

  insert into public.user_roles (user_id, role)
  values (target_id, 'admin')
  on conflict do nothing;

  return query select target_id, _email;
end;
$$;

grant execute on function public.promote_to_admin(text) to authenticated;

-- ---------- TOURNAMENTS / TEAMS / MATCHES -----------------------------
create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  players_per_team int not null default 2,
  games_per_round int not null default 1,
  prize_first text,
  prize_second text,
  prize_third text,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  name text not null,
  color text not null default 'team-a',
  created_at timestamptz not null default now()
);

create table public.team_players (
  id uuid primary key default gen_random_uuid(),
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text,
  unique (team_id, email)
);

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid references public.tournaments(id) on delete cascade,
  table_name text not null,
  team_a_id uuid references public.teams(id) on delete cascade,
  team_b_id uuid references public.teams(id) on delete cascade,
  score_a int not null default 0,
  score_b int not null default 0,
  status text not null default 'live',
  winner_team_id uuid references public.teams(id) on delete set null,
  round int not null default 1,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create table public.round_entries (
  id uuid primary key default gen_random_uuid(),
  match_id uuid references public.matches(id) on delete cascade not null,
  team_id uuid references public.teams(id) on delete cascade not null,
  high boolean not null default false,
  low boolean not null default false,
  jack int not null default 0,
  game boolean not null default false,
  total int not null default 0,
  submitted_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

grant select on public.tournaments to anon, authenticated;
grant insert, update, delete on public.tournaments to authenticated;
grant all on public.tournaments to service_role;

grant select on public.teams to anon, authenticated;
grant insert, update, delete on public.teams to authenticated;
grant all on public.teams to service_role;

grant select on public.team_players to anon, authenticated;
grant insert, update, delete on public.team_players to authenticated;
grant all on public.team_players to service_role;

grant select on public.matches to anon, authenticated;
grant insert, update, delete on public.matches to authenticated;
grant all on public.matches to service_role;

grant select on public.round_entries to anon, authenticated;
grant insert on public.round_entries to authenticated;
grant all on public.round_entries to service_role;

alter table public.tournaments enable row level security;
alter table public.teams enable row level security;
alter table public.team_players enable row level security;
alter table public.matches enable row level security;
alter table public.round_entries enable row level security;

create policy "tournaments readable by all" on public.tournaments for select using (true);
create policy "admins write tournaments" on public.tournaments
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "teams readable by all" on public.teams for select using (true);
create policy "admins write teams" on public.teams
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "team_players readable by all" on public.team_players for select using (true);
create policy "admins write team_players" on public.team_players
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "matches readable by all" on public.matches for select using (true);
create policy "admins write matches" on public.matches
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

create policy "round_entries readable by all" on public.round_entries for select using (true);
create policy "authenticated users insert entries" on public.round_entries
  for insert to authenticated with check (submitted_by = auth.uid());
create policy "admins manage round_entries" on public.round_entries
  for all to authenticated
  using (public.has_role(auth.uid(), 'admin'))
  with check (public.has_role(auth.uid(), 'admin'));

-- Realtime
alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.round_entries;
