-- Disposal management: instruction flags, access restriction, private media.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS is_instructed boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS terms_of_engagement text
    CHECK (
      terms_of_engagement IS NULL
      OR terms_of_engagement IN ('yes', 'no', 'pending')
    ),
  ADD COLUMN IF NOT EXISTS restrict_access_to_assigned boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.commercial_listings.is_instructed IS
  'False = market intel only (not an instruction).';
COMMENT ON COLUMN public.commercial_listings.terms_of_engagement IS
  'Whether Terms of Engagement have been agreed: yes | no | pending.';
COMMENT ON COLUMN public.commercial_listings.restrict_access_to_assigned IS
  'When true, prefer limiting visibility to acting agents + PA (app-enforced).';

ALTER TABLE public.commercial_listing_media
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS commercial_listing_media_private_idx
  ON public.commercial_listing_media (listing_id)
  WHERE is_private = true;

COMMENT ON COLUMN public.commercial_listing_media.is_private IS
  'Private files/images shown on Management — excluded from marketing media and portal feeds.';
