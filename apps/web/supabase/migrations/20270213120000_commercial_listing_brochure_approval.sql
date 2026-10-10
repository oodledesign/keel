-- Brochure review: who approved the saved layout, when, and which Media row
-- holds the published PDF. Feeds only send published brochure Media rows.

ALTER TABLE public.commercial_listing_brochures
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid
    REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS published_media_id uuid
    REFERENCES public.commercial_listing_media (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS commercial_listing_brochures_published_media_id_idx
  ON public.commercial_listing_brochures (published_media_id)
  WHERE published_media_id IS NOT NULL;

COMMENT ON COLUMN public.commercial_listing_brochures.approved_at IS
  'When someone approved this layout in the brochure wizard and published it. Compared with updated_at to show "Edited since publishing".';

COMMENT ON COLUMN public.commercial_listing_brochures.approved_by IS
  'User who approved and published this brochure.';

COMMENT ON COLUMN public.commercial_listing_brochures.published_media_id IS
  'commercial_listing_media row (media_type brochure) holding the published PDF. Replaced on each publish.';

-- updated_at tracks layout edits only, so recording an approval does not
-- immediately read as "edited since publishing".
CREATE OR REPLACE FUNCTION public.set_commercial_listing_brochures_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.pages IS DISTINCT FROM OLD.pages
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
