-- =====================================================================
-- Stumbling Fours — avatars storage bucket + RLS policies
-- Run this in the Supabase SQL editor of project iiafmwsjvduswcmmsurz
-- =====================================================================

-- Create the avatars bucket (public so images are viewable without auth)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,                          -- public bucket — anyone can view images
  5242880,                       -- 5 MB max per file
  array['image/jpeg','image/png','image/webp','image/gif']
)
on conflict (id) do update set
  public            = excluded.public,
  file_size_limit   = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- ── Storage RLS policies ──────────────────────────────────────────────────

-- 1. Anyone (including anon) can read/view avatar images
create policy "avatars are publicly readable"
on storage.objects for select
using ( bucket_id = 'avatars' );

-- 2. A logged-in user can upload their own avatar
--    File path must be: <user_id>.<ext>  e.g. "abc-123.jpg"
create policy "users can upload own avatar"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'avatars'
  and (storage.foldername(name))[1] = ''   -- no subfolders
  and starts_with(name, auth.uid()::text)  -- filename starts with their own user ID
);

-- 3. A logged-in user can update (overwrite) their own avatar
create policy "users can update own avatar"
on storage.objects for update to authenticated
using (
  bucket_id = 'avatars'
  and starts_with(name, auth.uid()::text)
);

-- 4. A logged-in user can delete their own avatar
create policy "users can delete own avatar"
on storage.objects for delete to authenticated
using (
  bucket_id = 'avatars'
  and starts_with(name, auth.uid()::text)
);
