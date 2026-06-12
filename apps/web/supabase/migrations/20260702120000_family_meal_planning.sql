-- Family meal planning: personal (user-scoped) recipe library, dietary
-- preferences, and a weekly meal plan that an AI generator can fill out.

-- ---------- Recipe library ----------
CREATE TABLE IF NOT EXISTS public.family_recipes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  ingredients text[] NOT NULL DEFAULT '{}',
  instructions text,
  tags text[] NOT NULL DEFAULT '{}',
  meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'any')),
  prep_minutes integer CHECK (prep_minutes IS NULL OR prep_minutes >= 0),
  cook_minutes integer CHECK (cook_minutes IS NULL OR cook_minutes >= 0),
  servings integer CHECK (servings IS NULL OR servings > 0),
  is_favorite boolean NOT NULL DEFAULT false,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'ai')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_family_recipes_user_id
  ON public.family_recipes(user_id);
CREATE INDEX IF NOT EXISTS ix_family_recipes_user_name
  ON public.family_recipes(user_id, lower(name));
CREATE INDEX IF NOT EXISTS ix_family_recipes_tags
  ON public.family_recipes USING gin (tags);

COMMENT ON TABLE public.family_recipes IS
  'Personal recipe library used by the family meal planner.';

-- ---------- Dietary preferences (one row per user) ----------
CREATE TABLE IF NOT EXISTS public.family_meal_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  dietary_requirements text[] NOT NULL DEFAULT '{}',
  priorities text[] NOT NULL DEFAULT '{}',
  disliked_ingredients text[] NOT NULL DEFAULT '{}',
  household_size integer NOT NULL DEFAULT 2
    CHECK (household_size > 0 AND household_size <= 30),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.family_meal_preferences IS
  'Per-user dietary requirements and generator priorities (healthy, quick, cheap, etc.).';

-- ---------- Weekly meal plan entries ----------
CREATE TABLE IF NOT EXISTS public.family_meal_plan_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_date date NOT NULL,
  meal_type text NOT NULL DEFAULT 'dinner'
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  recipe_id uuid REFERENCES public.family_recipes(id) ON DELETE SET NULL,
  title text NOT NULL DEFAULT '',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, plan_date, meal_type)
);

CREATE INDEX IF NOT EXISTS ix_family_meal_plan_entries_user_date
  ON public.family_meal_plan_entries(user_id, plan_date);

COMMENT ON TABLE public.family_meal_plan_entries IS
  'A scheduled meal for a given date/slot, optionally linked to a recipe.';

-- ---------- Timestamps ----------
DROP TRIGGER IF EXISTS family_recipes_set_timestamps ON public.family_recipes;
CREATE TRIGGER family_recipes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_recipes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS family_meal_preferences_set_timestamps ON public.family_meal_preferences;
CREATE TRIGGER family_meal_preferences_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_meal_preferences
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS family_meal_plan_entries_set_timestamps ON public.family_meal_plan_entries;
CREATE TRIGGER family_meal_plan_entries_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_meal_plan_entries
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------- RLS ----------
ALTER TABLE public.family_recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_meal_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_meal_plan_entries ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_meal_preferences TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_meal_plan_entries TO authenticated, service_role;

-- family_recipes policies
DROP POLICY IF EXISTS family_recipes_select ON public.family_recipes;
CREATE POLICY family_recipes_select ON public.family_recipes
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_recipes_insert ON public.family_recipes;
CREATE POLICY family_recipes_insert ON public.family_recipes
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_recipes_update ON public.family_recipes;
CREATE POLICY family_recipes_update ON public.family_recipes
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_recipes_delete ON public.family_recipes;
CREATE POLICY family_recipes_delete ON public.family_recipes
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- family_meal_preferences policies
DROP POLICY IF EXISTS family_meal_preferences_select ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_select ON public.family_meal_preferences
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_preferences_insert ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_insert ON public.family_meal_preferences
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_preferences_update ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_update ON public.family_meal_preferences
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_preferences_delete ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_delete ON public.family_meal_preferences
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- family_meal_plan_entries policies
DROP POLICY IF EXISTS family_meal_plan_entries_select ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_select ON public.family_meal_plan_entries
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_plan_entries_insert ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_insert ON public.family_meal_plan_entries
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_plan_entries_update ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_update ON public.family_meal_plan_entries
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS family_meal_plan_entries_delete ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_delete ON public.family_meal_plan_entries
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

NOTIFY pgrst, 'reload schema';
