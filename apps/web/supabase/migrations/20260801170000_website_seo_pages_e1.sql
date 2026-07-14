-- Prompt E1: website_seo_pages gains page_slug + seo jsonb + status.
-- Additive: keep page_id + fields for back-compat; sync on write.

ALTER TABLE public.website_seo_pages
  ADD COLUMN IF NOT EXISTS page_slug text,
  ADD COLUMN IF NOT EXISTS seo jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'draft';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'website_seo_pages_status_check'
  ) THEN
    ALTER TABLE public.website_seo_pages
      ADD CONSTRAINT website_seo_pages_status_check
      CHECK (status IN ('draft', 'approved'));
  END IF;
END $$;

COMMENT ON TABLE public.website_seo_pages IS
  'Site Studio search readiness (E1): per-page SEO/GEO/AEO jsonb with draft|approved status.';

COMMENT ON COLUMN public.website_seo_pages.seo IS
  'WebsiteSeoPageSeo jsonb — schemaVersion, keywords, meta, headingOutline, geo, aeo, technical…';

COMMENT ON COLUMN public.website_seo_pages.page_slug IS
  'Sitemap page slug; unique per website when set.';

COMMENT ON COLUMN public.website_seo_pages.status IS
  'draft until user approves the search plan; then approved.';

COMMENT ON COLUMN public.website_seo_pages.fields IS
  'Legacy flat SEO fields — kept in sync with seo for older readers.';

-- Unique slug when present (nulls allowed during backfill).
CREATE UNIQUE INDEX IF NOT EXISTS ux_website_seo_pages_website_slug
  ON public.website_seo_pages (website_id, page_slug)
  WHERE page_slug IS NOT NULL AND length(trim(page_slug)) > 0;

-- Prefer nested seo when empty but legacy fields exist.
-- Note: copies flat legacy JSON into `seo`; readers normalise via
-- normalizeWebsiteSeoPageSeo. Next save upgrades to nested E1 shape.
UPDATE public.website_seo_pages
SET seo = fields
WHERE (seo = '{}'::jsonb OR seo IS NULL)
  AND fields IS NOT NULL
  AND fields <> '{}'::jsonb;
