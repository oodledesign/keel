-- Brochure-wide settings edited in the wizard (footer office line, notice and
-- page numbers). Pages stay in `pages`; rebuilding them keeps these.

ALTER TABLE public.commercial_listing_brochures
  ADD COLUMN IF NOT EXISTS settings jsonb NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.commercial_listing_brochures.settings IS
  'Brochure-wide settings, e.g. {"footer": {"showOffice": true, "officeText": "", "showNotice": true, "noticeText": "", "showPageNumbers": true}}. Unset keys use the defaults.';

-- Settings change the PDF, so they count as layout edits for "Edited since
-- publishing" and the publish check against the previewed version.
CREATE OR REPLACE FUNCTION public.set_commercial_listing_brochures_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.pages IS DISTINCT FROM OLD.pages
    OR NEW.settings IS DISTINCT FROM OLD.settings
    OR NEW.template_id IS DISTINCT FROM OLD.template_id
    OR NEW.orientation IS DISTINCT FROM OLD.orientation
    OR NEW.page_size IS DISTINCT FROM OLD.page_size
  THEN
    NEW.updated_at = now();
  ELSE
    NEW.updated_at = OLD.updated_at;
  END IF;
  RETURN NEW;
END;
$$;
