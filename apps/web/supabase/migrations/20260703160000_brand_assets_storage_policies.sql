-- Ensure brand-assets bucket exists for workspace logos (emails, signatures, brand settings).
-- Admin uploads bypass RLS; policies allow authenticated workspace admins as a fallback.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'brand-assets',
  'brand-assets',
  true,
  5242880,
  ARRAY['image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif']::text[]
)
ON CONFLICT (id) DO UPDATE SET
  name = excluded.name,
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

DROP POLICY IF EXISTS brand_assets_public_read ON storage.objects;
CREATE POLICY brand_assets_public_read ON storage.objects
  FOR SELECT TO authenticated, anon
  USING (bucket_id = 'brand-assets');

DROP POLICY IF EXISTS brand_assets_insert ON storage.objects;
CREATE POLICY brand_assets_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS brand_assets_update ON storage.objects;
CREATE POLICY brand_assets_update ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  )
  WITH CHECK (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );

DROP POLICY IF EXISTS brand_assets_delete ON storage.objects;
CREATE POLICY brand_assets_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'brand-assets'
    AND (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
    AND public.has_permission(
      auth.uid(),
      ((storage.foldername(name))[1])::uuid,
      'settings.manage'::public.app_permissions
    )
  );

-- Repair legacy storage URLs missing the /public/ segment (browser loads return 400).
UPDATE public.accounts
SET picture_url = regexp_replace(
  picture_url,
  '/storage/v1/object/(account_image|brand-assets)/',
  '/storage/v1/object/public/\1/'
)
WHERE picture_url IS NOT NULL
  AND picture_url ~ '/storage/v1/object/(account_image|brand-assets)/'
  AND picture_url !~ '/storage/v1/object/public/';

UPDATE public.account_brand_settings
SET logo_url = regexp_replace(
  logo_url,
  '/storage/v1/object/(account_image|brand-assets)/',
  '/storage/v1/object/public/\1/'
)
WHERE logo_url IS NOT NULL
  AND logo_url ~ '/storage/v1/object/(account_image|brand-assets)/'
  AND logo_url !~ '/storage/v1/object/public/';

UPDATE public.agency_branding
SET logo_url = regexp_replace(
  logo_url,
  '/storage/v1/object/(account_image|brand-assets)/',
  '/storage/v1/object/public/\1/'
)
WHERE logo_url IS NOT NULL
  AND logo_url ~ '/storage/v1/object/(account_image|brand-assets)/'
  AND logo_url !~ '/storage/v1/object/public/';

NOTIFY pgrst, 'reload schema';
