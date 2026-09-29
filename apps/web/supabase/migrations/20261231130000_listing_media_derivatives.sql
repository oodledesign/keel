-- Pre-sized display copies of listing photos, generated at upload time so the
-- app never needs Supabase Image Transformations. `storage_path` stays the
-- full-quality original used by portals, brochures and LinkedIn.

ALTER TABLE public.commercial_listing_media
  ADD COLUMN IF NOT EXISTS thumb_path text,
  ADD COLUMN IF NOT EXISTS preview_path text;

COMMENT ON COLUMN public.commercial_listing_media.thumb_path IS
  'Storage path of a small JPEG copy (card covers, table chips). NULL falls back to preview_path, then storage_path.';
COMMENT ON COLUMN public.commercial_listing_media.preview_path IS
  'Storage path of a gallery-sized JPEG copy. NULL falls back to storage_path.';
