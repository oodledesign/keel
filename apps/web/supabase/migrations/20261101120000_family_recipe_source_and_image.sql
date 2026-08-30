-- Optional import provenance + cover image for family recipes.
-- Cover bytes live in the existing public account_image bucket
-- ({account_id|user_id}/recipe-{recipe_id}); image_url is the copied public URL.

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS image_url text;

ALTER TABLE public.family_recipes
  DROP CONSTRAINT IF EXISTS family_recipes_source_url_http;

ALTER TABLE public.family_recipes
  ADD CONSTRAINT family_recipes_source_url_http
  CHECK (
    source_url IS NULL
    OR source_url ~* '^https?://[^[:space:]]+$'
  );

COMMENT ON COLUMN public.family_recipes.source_url IS
  'Optional http(s) URL of the Instagram post or web page this recipe was imported from.';

COMMENT ON COLUMN public.family_recipes.image_url IS
  'Optional cover image copied into the account_image bucket (not a hotlink).';

-- Personal: folder is auth.uid() (personal account id). Workspace: folder is the team account.
DROP POLICY IF EXISTS account_image_family_recipes ON storage.objects;

CREATE POLICY account_image_family_recipes ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'recipe-%'
  AND (
    ((string_to_array(name, '/'))[1])::uuid = (SELECT auth.uid())
    OR public.has_role_on_account(((string_to_array(name, '/'))[1])::uuid)
  )
)
WITH CHECK (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'recipe-%'
  AND (
    ((string_to_array(name, '/'))[1])::uuid = (SELECT auth.uid())
    OR public.has_role_on_account(((string_to_array(name, '/'))[1])::uuid)
  )
);
