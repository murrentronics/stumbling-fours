-- =====================================================================
-- Stumbling Fours — Fix admin status updates on profiles
-- Run in Supabase SQL editor
-- =====================================================================

-- ---------- 1. Add status column if it doesn't exist yet -------------
alter table public.profiles
  add column if not exists status text not null default 'pending';

-- ---------- 2. Drop old check constraint (any name it might have) ----
do $$
declare
  r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'c'
      and conname ilike '%status%'
  loop
    execute 'alter table public.profiles drop constraint ' || quote_ident(r.conname);
  end loop;
end;
$$;

-- ---------- 3. Re-add constraint with all 4 valid values -------------
alter table public.profiles
  add constraint profiles_status_check
    check (status in ('pending', 'active', 'suspended', 'banned'));

-- ---------- 4. Drop and recreate admin update policy cleanly ---------
drop policy if exists "admins update any profile" on public.profiles;

create policy "admins update any profile"
on public.profiles
for update
to authenticated
using (public.has_role(auth.uid(), 'admin'))
with check (public.has_role(auth.uid(), 'admin'));

-- ---------- 5. Ensure select policy exists ---------------------------
drop policy if exists "profiles readable by signed-in users" on public.profiles;

create policy "profiles readable by signed-in users"
on public.profiles
for select
to authenticated
using (true);

-- ---------- 6. Back-fill: players with a role stuck as pending -------
update public.profiles p
set status = 'active'
where status = 'pending'
  and exists (
    select 1 from public.user_roles ur
    where ur.user_id = p.id
  );

-- ---------- 7. Sanity check — shows current status counts ------------
select status, count(*) as total
from public.profiles
group by status
order by status;
