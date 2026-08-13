-- Allow WIP note created_at to be set on insert/update (CSV backdates + user-picked dates).
-- Default trigger_set_timestamps always forced now() on insert and locked created_at on update.

DROP TRIGGER IF EXISTS notes_set_timestamps ON public.notes;

CREATE OR REPLACE FUNCTION public.notes_set_timestamps()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.created_at IS NULL THEN
      NEW.created_at = now();
    END IF;
    IF NEW.updated_at IS NULL THEN
      NEW.updated_at = NEW.created_at;
    END IF;
  ELSE
    NEW.updated_at = now();
    -- Allow explicit created_at changes (activity backdating).
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW
  EXECUTE FUNCTION public.notes_set_timestamps();

-- Bracketts requirements board colour categories (Class B / Class E / Land / …).
ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS use_class text;

COMMENT ON COLUMN public.commercial_requirements.use_class IS
  'Applicant use-class category for board colouring: class_b, class_e, land, investment, development, sui_generis, pending.';

CREATE INDEX IF NOT EXISTS ix_commercial_requirements_account_use_class
  ON public.commercial_requirements (account_id, use_class)
  WHERE use_class IS NOT NULL;
