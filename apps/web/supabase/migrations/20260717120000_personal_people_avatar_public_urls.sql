-- Repair personal people avatar URLs still missing the /public/ storage segment.

UPDATE public.personal_people
SET avatar_url = regexp_replace(
  avatar_url,
  '/storage/v1/object/(account_image|brand-assets)/',
  '/storage/v1/object/public/\1/'
)
WHERE avatar_url IS NOT NULL
  AND avatar_url ~ '/storage/v1/object/(account_image|brand-assets)/'
  AND avatar_url !~ '/storage/v1/object/public/';
