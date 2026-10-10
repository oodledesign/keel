-- Workspace brand typography for brochures (PDF and online) and public pages.
-- Null keeps each surface's standard fonts. The app validates ids against its
-- bundled font list; the check only guards the shape.

ALTER TABLE public.account_brand_settings
  ADD COLUMN IF NOT EXISTS heading_font text,
  ADD COLUMN IF NOT EXISTS body_font text;

ALTER TABLE public.account_brand_settings
  DROP CONSTRAINT IF EXISTS account_brand_settings_heading_font_check;

ALTER TABLE public.account_brand_settings
  ADD CONSTRAINT account_brand_settings_heading_font_check
  CHECK (heading_font IS NULL OR heading_font ~ '^[a-z][a-z0-9-]{1,39}$');

ALTER TABLE public.account_brand_settings
  DROP CONSTRAINT IF EXISTS account_brand_settings_body_font_check;

ALTER TABLE public.account_brand_settings
  ADD CONSTRAINT account_brand_settings_body_font_check
  CHECK (body_font IS NULL OR body_font ~ '^[a-z][a-z0-9-]{1,39}$');

COMMENT ON COLUMN public.account_brand_settings.heading_font IS
  'Brand heading typeface id (e.g. lora, montserrat) for brochures and public pages. Null = standard fonts.';

COMMENT ON COLUMN public.account_brand_settings.body_font IS
  'Brand body typeface id (e.g. inter, helvetica) for brochures and public pages. Null = standard fonts.';
