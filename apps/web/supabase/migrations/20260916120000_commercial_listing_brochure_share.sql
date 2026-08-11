-- Public client-facing brochure slideshow share (separate from landlord interest share)

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS brochure_share_token text UNIQUE,
  ADD COLUMN IF NOT EXISTS brochure_share_enabled boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS commercial_listings_brochure_share_token_idx
  ON public.commercial_listings (brochure_share_token)
  WHERE brochure_share_token IS NOT NULL;

COMMENT ON COLUMN public.commercial_listings.brochure_share_token IS
  'Opaque token for the public brochure slideshow at /share/brochure/[token].';
COMMENT ON COLUMN public.commercial_listings.brochure_share_enabled IS
  'When true, the brochure slideshow is viewable without signing in.';

-- Intentionally no anon SELECT policy: public access is token-gated via
-- admin client only (same reliability path as /share/listing). A boolean
-- policy without token check would let anon enumerate share-enabled rows.

-- Allow brochure as an enquiry source from the public slideshow form
ALTER TABLE public.commercial_enquiries
  DROP CONSTRAINT IF EXISTS commercial_enquiries_source_check;

ALTER TABLE public.commercial_enquiries
  ADD CONSTRAINT commercial_enquiries_source_check
  CHECK (source IN (
    'manual', 'website', 'rightmove', 'each', 'other', 'brochure'
  ));
