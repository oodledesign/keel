-- Sale price display qualifier for commercial disposals (portal-canonical wording).
-- none = bare asking price; otherwise prefix Offers in Excess of / Offers in Region of / Guide Price.

ALTER TABLE public.commercial_listings
  ADD COLUMN IF NOT EXISTS asking_price_qualifier text NOT NULL DEFAULT 'none';

ALTER TABLE public.commercial_listings
  DROP CONSTRAINT IF EXISTS commercial_listings_asking_price_qualifier_check;

ALTER TABLE public.commercial_listings
  ADD CONSTRAINT commercial_listings_asking_price_qualifier_check
    CHECK (
      asking_price_qualifier = ANY (
        ARRAY[
          'none'::text,
          'offers_in_excess_of'::text,
          'offers_in_region_of'::text,
          'guide_price'::text
        ]
      )
    );

COMMENT ON COLUMN public.commercial_listings.asking_price_qualifier IS
  'Sale price prefix for marketing: none (asking price), offers_in_excess_of, offers_in_region_of, guide_price. POA is hide_price_from_marketing.';
