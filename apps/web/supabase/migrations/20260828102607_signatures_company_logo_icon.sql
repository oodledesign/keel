-- Company logo (full wordmark) + company icon for Signatures templates.
-- Logo block prefers company_logo_url, then falls back to brand business logo.
-- Company icon badges staff photos (bottom-right) or fills the photo slot when missing.

ALTER TABLE signatures.workspace_settings
  ADD COLUMN IF NOT EXISTS company_logo_url text,
  ADD COLUMN IF NOT EXISTS company_icon_url text;

COMMENT ON COLUMN signatures.workspace_settings.company_logo_url IS
  'Optional full company logo for signature logo blocks. Falls back to brand business logo when null.';

COMMENT ON COLUMN signatures.workspace_settings.company_icon_url IS
  'Optional square company icon: badges bottom-right of staff photo, or fills photo slot when no photo.';

NOTIFY pgrst, 'reload schema';
