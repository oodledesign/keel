-- Optional import provenance + cover image for family recipes.
-- Cover bytes live in the existing public account_image bucket
-- ({account_id|user_id}/recipe-{recipe_id}); image_url is the copied public URL.
-- URL imports are instagram/website (never 'ai'); source_label is the origin chip.

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS source_url text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS source_label text;

DO $$
DECLARE
  cons record;
BEGIN
  FOR cons IN
    SELECT con.conname
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    JOIN pg_namespace nsp ON nsp.oid = rel.relnamespace
    WHERE nsp.nspname = 'public'
      AND rel.relname = 'family_recipes'
      AND con.contype = 'c'
      AND pg_get_constraintdef(con.oid) ILIKE '%source%manual%ai%'
      AND pg_get_constraintdef(con.oid) NOT ILIKE '%source_url%'
  LOOP
    EXECUTE format(
      'ALTER TABLE public.family_recipes DROP CONSTRAINT IF EXISTS %I',
      cons.conname
    );
  END LOOP;
END $$;

ALTER TABLE public.family_recipes
  DROP CONSTRAINT IF EXISTS family_recipes_source_check;

ALTER TABLE public.family_recipes
  ADD CONSTRAINT family_recipes_source_check
  CHECK (source IN ('manual', 'ai', 'instagram', 'website'));

COMMENT ON COLUMN public.family_recipes.source IS
  'Origin kind: manual, ai (paste/photo extract or generated), instagram, or website.';

COMMENT ON COLUMN public.family_recipes.source_label IS
  'Human origin chip: Instagram, og:site_name / publisher, or a tidy hostname.';

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
