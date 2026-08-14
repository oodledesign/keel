-- Marketing Phase 1+ fields + expanded media categories for commercial disposals.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS website_url text,
  ADD COLUMN IF NOT EXISTS amenities jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS marketing_sections jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.commercial_listings.website_url IS
  'Public marketing website URL for this disposal.';
COMMENT ON COLUMN public.commercial_listings.amenities IS
  'Ordered amenity/specification tag strings for marketing.';
COMMENT ON COLUMN public.commercial_listings.marketing_sections IS
  'Optional marketing text blocks: [{ id, kind, title, body }].';

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_summary_len_check;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_summary_len_check
  CHECK (summary IS NULL OR char_length(summary) <= 140);

ALTER TABLE public.commercial_listing_media
  DROP CONSTRAINT IF EXISTS commercial_listing_media_media_type_check;

ALTER TABLE public.commercial_listing_media
  ADD CONSTRAINT commercial_listing_media_media_type_check
  CHECK (
    media_type IN (
      'image',
      'brochure',
      'floorplan',
      'epc',
      'video',
      'other',
      'aerial',
      'goad'
    )
  );

NOTIFY pgrst, 'reload schema';
