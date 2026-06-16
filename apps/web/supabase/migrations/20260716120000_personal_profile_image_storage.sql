-- Personal profile avatars: flat path {account_uuid}.{ext} or legacy {account_uuid}

DROP POLICY IF EXISTS account_image_personal_profile ON storage.objects;

CREATE POLICY account_image_personal_profile ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'account_image'
  AND (
    name ~ '^[0-9a-fA-F-]{36}$'
    OR name ~ '^[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+$'
  )
  AND EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = split_part(name, '.', 1)::uuid
      AND a.is_personal_account = true
      AND a.primary_owner_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'account_image'
  AND (
    name ~ '^[0-9a-fA-F-]{36}$'
    OR name ~ '^[0-9a-fA-F-]{36}\.[a-zA-Z0-9]+$'
  )
  AND EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = split_part(name, '.', 1)::uuid
      AND a.is_personal_account = true
      AND a.primary_owner_user_id = auth.uid()
  )
);

-- Repair any profile URLs still missing the /public/ segment.
UPDATE public.accounts
SET picture_url = regexp_replace(
  picture_url,
  '/storage/v1/object/(account_image|brand-assets)/',
  '/storage/v1/object/public/\1/'
)
WHERE picture_url IS NOT NULL
  AND picture_url ~ '/storage/v1/object/(account_image|brand-assets)/'
  AND picture_url !~ '/storage/v1/object/public/';
