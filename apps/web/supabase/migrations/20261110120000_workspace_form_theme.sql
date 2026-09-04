-- Per-form presentation theme (page background style, etc.).
-- Prefer jsonb over dedicated columns so we can extend without migrations.

ALTER TABLE public.workspace_forms
  ADD COLUMN IF NOT EXISTS theme jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'workspace_forms_theme_is_object'
      AND conrelid = 'public.workspace_forms'::regclass
  ) THEN
    ALTER TABLE public.workspace_forms
      ADD CONSTRAINT workspace_forms_theme_is_object
      CHECK (jsonb_typeof(theme) = 'object');
  END IF;
END $$;

COMMENT ON COLUMN public.workspace_forms.theme IS
  'Per-form presentation JSON. Known keys: pageBackground (light | brand_gradient).';

NOTIFY pgrst, 'reload schema';
