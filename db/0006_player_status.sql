-- =====================================================================
-- Stumbling Fours — Player status management
-- Run in Supabase SQL editor after 0005_fix_avatars_insert_policy.sql
-- =====================================================================

-- ---------- 1. Add status column to profiles --------------------------
-- pending   = new signup, awaiting admin approval
-- active    = approved, can use the app
-- suspended = temporarily blocked, put back to pending state
-- banned    = permanently blocked

alter table public.profiles
  add column if not exists status text not null default 'pending'
    check (status in ('pending', 'active', 'suspended', 'banned'));

-- Back-fill: any existing user who already has a role is considered active
update public.profiles p
set status = 'active'
where exists (
  select 1 from public.user_roles ur
  where ur.user_id = p.id
);

-- ---------- 2. Banned emails table ------------------------------------
-- Keeps email blocklist even after the auth.users row is deleted.
create table if not exists public.banned_emails (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  banned_at timestamptz not null default now(),
  banned_by uuid references auth.users(id) on delete set null,
  reason text
);

grant select on public.banned_emails to authenticated;
grant all on public.banned_emails to service_role;

alter table public.banned_emails enable row level security;

create policy "admins manage banned_emails"
on public.banned_emails for all to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ---------- 3. Allow admins to update any profile status --------------
drop policy if exists "admins update any profile" on public.profiles;
create policy "admins update any profile"
on public.profiles for update to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ---------- 4. Allow admins to delete profiles ------------------------
drop policy if exists "admins delete profiles" on public.profiles;
create policy "admins delete profiles"
on public.profiles for delete to authenticated
using (public.has_role(auth.uid(), 'admin'));

-- ---------- 5. Realtime on profiles and banned_emails -----------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.banned_emails;

-- ---------- 6. Trigger: block banned emails from signing up -----------
-- Checks banned_emails on every new auth.users insert.
create or replace function public.block_banned_signup()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1 from public.banned_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'This email address is not permitted to sign up.';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_banned_signup on auth.users;
create trigger trg_block_banned_signup
before insert on auth.users
for each row execute function public.block_banned_signup();

-- ---------- 7. Update handle_new_user to start as pending -------------
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    case
      -- First / known admin emails are auto-approved
      when lower(new.email) = 'theronmurren@gfmail.com' then 'active'
      else 'pending'
    end
  )
  on conflict (id) do nothing;

  -- Grant role
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
