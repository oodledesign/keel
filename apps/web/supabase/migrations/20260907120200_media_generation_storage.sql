-- Private bucket for AI-generated media + reference uploads.
-- Path prefix: {account_id}/...

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'media-generation',
  'media-generation',
  false,
  52428800,
  ARRAY[
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/webm',
    'application/octet-stream'
  ]::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS media_generation_select ON storage.objects;
CREATE POLICY media_generation_select ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'media-generation'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );

DROP POLICY IF EXISTS media_generation_insert ON storage.objects;
CREATE POLICY media_generation_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'media-generation'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );
