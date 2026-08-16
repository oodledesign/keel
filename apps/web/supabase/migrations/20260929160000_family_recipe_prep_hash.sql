-- Cache hash of ingredients used to generate the auto Prep (mise-en-place) step.
-- Regenerate only when the hash changes (Prompt 5).

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS prep_ingredients_hash text;

COMMENT ON COLUMN public.family_recipes.prep_ingredients_hash IS
  'SHA-256 of normalised ingredient lines used for the last generated Prep step. Null when no Prep has been generated.';

NOTIFY pgrst, 'reload schema';
