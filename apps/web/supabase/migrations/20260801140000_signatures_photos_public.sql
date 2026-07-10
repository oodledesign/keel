-- Signature photos must be publicly readable: Outlook/Gmail (and the
-- in-app preview iframe) cannot authenticate to Supabase Storage.

UPDATE storage.buckets
SET public = true
WHERE id = 'signatures-photos';

DROP POLICY IF EXISTS signatures_photos_select_members ON storage.objects;
DROP POLICY IF EXISTS signatures_photos_public_read ON storage.objects;

CREATE POLICY signatures_photos_public_read ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'signatures-photos');

-- Uploads continue via service_role (admin client); no insert policy for anon.
