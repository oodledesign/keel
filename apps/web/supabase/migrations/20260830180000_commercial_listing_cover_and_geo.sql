-- Cover image for listings list/header, plus geo fields for maps & XML feed.
ALTER TABLE public.commercial_listing_media
  ADD COLUMN IF NOT EXISTS is_cover boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS commercial_listing_media_cover_idx
  ON public.commercial_listing_media (listing_id)
  WHERE is_cover = true;

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS county text,
  ADD COLUMN IF NOT EXISTS latitude double precision,
  ADD COLUMN IF NOT EXISTS longitude double precision;
