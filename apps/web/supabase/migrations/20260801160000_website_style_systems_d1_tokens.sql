-- Prompt D1: promote style system tokens + moodboard to first-class JSONB columns.
-- Table website_style_systems already exists (20260801130000) with opaque `style` jsonb.
-- Additive: keep `style` in sync for back-compat / portal consumers.

ALTER TABLE public.website_style_systems
  ADD COLUMN IF NOT EXISTS tokens jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS moodboard jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS locked boolean NOT NULL DEFAULT false;

COMMENT ON TABLE public.website_style_systems IS
  'Site Studio design tokens (D1 StyleTokens with schemaVersion) + moodboard refs; locked prevents AI overwrite.';

COMMENT ON COLUMN public.website_style_systems.tokens IS
  'StyleTokens jsonb — schemaVersion, colors, typography, radius, spacingDensity, photographyDirection, buttons.';

COMMENT ON COLUMN public.website_style_systems.moodboard IS
  'Moodboard refs: url, note, optional imageRefs + extractedPalette.';

COMMENT ON COLUMN public.website_style_systems.locked IS
  'When true, AI suggest must not overwrite tokens.';

COMMENT ON COLUMN public.website_style_systems.style IS
  'Legacy composite { tokens, moodboard, locked } — kept in sync with dedicated columns.';

-- Backfill from legacy style jsonb when columns are still empty.
UPDATE public.website_style_systems
SET
  tokens = CASE
    WHEN tokens = '{}'::jsonb AND style ? 'tokens' THEN style -> 'tokens'
    ELSE tokens
  END,
  moodboard = CASE
    WHEN moodboard = '[]'::jsonb AND style ? 'moodboard' THEN COALESCE(style -> 'moodboard', '[]'::jsonb)
    ELSE moodboard
  END,
  locked = CASE
    WHEN style ? 'locked' THEN COALESCE((style ->> 'locked')::boolean, false)
    ELSE locked
  END
WHERE style IS NOT NULL AND style <> '{}'::jsonb;
