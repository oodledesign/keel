-- Public bucket for workspace logos (emails and external HTML must load without auth).

INSERT INTO storage.buckets (id, name, public)
VALUES ('brand-assets', 'brand-assets', TRUE)
ON CONFLICT (id)
DO UPDATE SET
  name = excluded.name,
  public = excluded.public;

-- Anyone can read public bucket objects (standard for public assets).

DROP POLICY IF EXISTS brand_assets_public_read ON storage.objects;

CREATE POLICY brand_assets_public_read ON storage.objects FOR SELECT TO authenticated, anon USING (
  bucket_id = 'brand-assets'
);

NOTIFY pgrst, 'reload schema';
