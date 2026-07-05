-- =====================================================================
-- Stumbling Fours — fix avatars INSERT policy
-- Run this in the Supabase SQL editor of project iiafmwsjvduswcmmsurz
--
-- The original INSERT policy in 0004 used:
--   (storage.foldername(name))[1] = ''
-- For flat files (no subfolder), storage.foldername() returns an empty
-- array {}, so [1] is NULL, and NULL = '' is NULL (falsy) — blocking
-- every upload with "new row violates row level security policy".
-- =====================================================================

-- Drop the broken policy
drop policy if exists "users can upload own avatar" on storage.objects;

-- Re-create it without the foldername check.
-- starts_with(name, auth.uid()::text) is sufficient: users can only
-- write files whose name begins with their own user ID (e.g. "abc-123.jpg").
create policy "users can upload own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and starts_with(name, auth.uid()::text)
);
