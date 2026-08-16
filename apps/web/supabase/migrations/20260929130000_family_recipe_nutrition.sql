-- Nutrition macros + diet tags for family recipes (additive).
-- Values are cached on the row and only recomputed when ingredients change.

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS calories_per_serving integer
    CHECK (calories_per_serving IS NULL OR calories_per_serving >= 0),
  ADD COLUMN IF NOT EXISTS protein_g numeric
    CHECK (protein_g IS NULL OR protein_g >= 0),
  ADD COLUMN IF NOT EXISTS carbs_g numeric
    CHECK (carbs_g IS NULL OR carbs_g >= 0),
  ADD COLUMN IF NOT EXISTS fat_g numeric
    CHECK (fat_g IS NULL OR fat_g >= 0),
  ADD COLUMN IF NOT EXISTS diet_tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS nutrition_computed_at timestamptz,
  ADD COLUMN IF NOT EXISTS nutrition_pending boolean NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS ix_family_recipes_nutrition_pending
  ON public.family_recipes(nutrition_pending)
  WHERE nutrition_pending = true;

COMMENT ON COLUMN public.family_recipes.calories_per_serving IS
  'Cached kcal per serving from Edamam (or null if unknown/pending).';
COMMENT ON COLUMN public.family_recipes.diet_tags IS
  'Merged diet/health tags (keyword pass + Edamam). Keyword pass wins on vegetarian/vegan.';
COMMENT ON COLUMN public.family_recipes.nutrition_pending IS
  'True when nutrition analysis failed or is waiting for credentials/retry.';

NOTIFY pgrst, 'reload schema';
