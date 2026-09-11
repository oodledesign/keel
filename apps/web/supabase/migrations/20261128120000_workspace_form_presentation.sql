-- Document the additive theme.presentation key (classic | steps).
-- Stored in existing jsonb so existing rows stay classic by default.

COMMENT ON COLUMN public.workspace_forms.theme IS
  'Per-form presentation JSON. Known keys: pageBackground (light | brand_gradient), layout (standard | event), layoutExplicit (boolean), presentation (classic | steps).';

NOTIFY pgrst, 'reload schema';
