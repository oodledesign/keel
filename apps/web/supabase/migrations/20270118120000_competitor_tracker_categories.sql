/*
 * Competitor Tracker categories: industrial, offices, retail (Class E),
 * investments, land. 'development' becomes 'land'.
 */

ALTER TABLE public.competitor_listings
  DROP CONSTRAINT IF EXISTS competitor_listings_category_check;

UPDATE public.competitor_listings
SET category = 'land'
WHERE category = 'development';

ALTER TABLE public.competitor_listings
  ADD CONSTRAINT competitor_listings_category_check
  CHECK (category IN ('industrial', 'offices', 'retail', 'investments', 'land'));

-- Watches store categories as text[]: remap development -> land, de-duplicated.
UPDATE public.competitor_area_watches
SET categories = (
  SELECT COALESCE(array_agg(DISTINCT c), '{}')
  FROM unnest(
    array_replace(categories, 'development', 'land')
  ) AS c
)
WHERE 'development' = ANY (categories);

ALTER TABLE public.competitor_area_watches
  ALTER COLUMN categories
  SET DEFAULT ARRAY['industrial', 'offices', 'retail', 'investments', 'land'];
