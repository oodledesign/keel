-- Structured recipe ingredients + method steps for family recipes (additive).
-- Keeps family_recipes.ingredients / instructions in sync for existing consumers.

CREATE TABLE IF NOT EXISTS public.family_recipe_ingredients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.family_recipes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  amount numeric,
  unit text,
  original_text text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_family_recipe_ingredients_recipe
  ON public.family_recipe_ingredients(recipe_id, sort_order);

COMMENT ON TABLE public.family_recipe_ingredients IS
  'Structured ingredient lines for a family recipe. original_text preserves the free-text line.';

CREATE TABLE IF NOT EXISTS public.family_recipe_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recipe_id uuid NOT NULL REFERENCES public.family_recipes(id) ON DELETE CASCADE,
  sort_order integer NOT NULL,
  title text NOT NULL,
  content text NOT NULL,
  timer_seconds integer CHECK (timer_seconds IS NULL OR timer_seconds >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_family_recipe_steps_recipe
  ON public.family_recipe_steps(recipe_id, sort_order);

COMMENT ON TABLE public.family_recipe_steps IS
  'Ordered method steps. content may include {ingredient_id} placeholders.';

CREATE TABLE IF NOT EXISTS public.family_recipe_step_ingredients (
  step_id uuid NOT NULL REFERENCES public.family_recipe_steps(id) ON DELETE CASCADE,
  ingredient_id uuid NOT NULL REFERENCES public.family_recipe_ingredients(id) ON DELETE CASCADE,
  quantity_multiplier numeric NOT NULL DEFAULT 1
    CHECK (quantity_multiplier > 0),
  PRIMARY KEY (step_id, ingredient_id)
);

COMMENT ON TABLE public.family_recipe_step_ingredients IS
  'Links steps to ingredients with an optional quantity multiplier (e.g. half the stock now).';

DROP TRIGGER IF EXISTS family_recipe_ingredients_set_timestamps
  ON public.family_recipe_ingredients;
CREATE TRIGGER family_recipe_ingredients_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_recipe_ingredients
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS family_recipe_steps_set_timestamps
  ON public.family_recipe_steps;
CREATE TRIGGER family_recipe_steps_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_recipe_steps
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.family_recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_recipe_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_recipe_step_ingredients ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_ingredients
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_steps
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_recipe_step_ingredients
  TO authenticated, service_role;

-- Access follows parent family_recipes (personal OR workspace member).
CREATE OR REPLACE FUNCTION public.family_recipe_is_accessible(p_recipe_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_recipes r
    WHERE r.id = p_recipe_id
      AND (
        (r.account_id IS NULL AND r.user_id = (SELECT auth.uid()))
        OR (r.account_id IS NOT NULL AND public.has_role_on_account(r.account_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.family_recipe_is_accessible(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.family_recipe_is_accessible(uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS family_recipe_ingredients_select ON public.family_recipe_ingredients;
CREATE POLICY family_recipe_ingredients_select ON public.family_recipe_ingredients
  FOR SELECT TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_ingredients_insert ON public.family_recipe_ingredients;
CREATE POLICY family_recipe_ingredients_insert ON public.family_recipe_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_ingredients_update ON public.family_recipe_ingredients;
CREATE POLICY family_recipe_ingredients_update ON public.family_recipe_ingredients
  FOR UPDATE TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id))
  WITH CHECK (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_ingredients_delete ON public.family_recipe_ingredients;
CREATE POLICY family_recipe_ingredients_delete ON public.family_recipe_ingredients
  FOR DELETE TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_steps_select ON public.family_recipe_steps;
CREATE POLICY family_recipe_steps_select ON public.family_recipe_steps
  FOR SELECT TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_steps_insert ON public.family_recipe_steps;
CREATE POLICY family_recipe_steps_insert ON public.family_recipe_steps
  FOR INSERT TO authenticated
  WITH CHECK (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_steps_update ON public.family_recipe_steps;
CREATE POLICY family_recipe_steps_update ON public.family_recipe_steps
  FOR UPDATE TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id))
  WITH CHECK (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_steps_delete ON public.family_recipe_steps;
CREATE POLICY family_recipe_steps_delete ON public.family_recipe_steps
  FOR DELETE TO authenticated
  USING (public.family_recipe_is_accessible(recipe_id));

DROP POLICY IF EXISTS family_recipe_step_ingredients_select
  ON public.family_recipe_step_ingredients;
CREATE POLICY family_recipe_step_ingredients_select
  ON public.family_recipe_step_ingredients
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_recipe_steps s
      WHERE s.id = step_id
        AND public.family_recipe_is_accessible(s.recipe_id)
    )
  );

DROP POLICY IF EXISTS family_recipe_step_ingredients_insert
  ON public.family_recipe_step_ingredients;
CREATE POLICY family_recipe_step_ingredients_insert
  ON public.family_recipe_step_ingredients
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.family_recipe_steps s
      JOIN public.family_recipe_ingredients i
        ON i.recipe_id = s.recipe_id
      WHERE s.id = step_id
        AND i.id = ingredient_id
        AND public.family_recipe_is_accessible(s.recipe_id)
    )
  );

DROP POLICY IF EXISTS family_recipe_step_ingredients_update
  ON public.family_recipe_step_ingredients;
CREATE POLICY family_recipe_step_ingredients_update
  ON public.family_recipe_step_ingredients
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_recipe_steps s
      WHERE s.id = step_id
        AND public.family_recipe_is_accessible(s.recipe_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.family_recipe_steps s
      JOIN public.family_recipe_ingredients i
        ON i.recipe_id = s.recipe_id
      WHERE s.id = step_id
        AND i.id = ingredient_id
        AND public.family_recipe_is_accessible(s.recipe_id)
    )
  );

DROP POLICY IF EXISTS family_recipe_step_ingredients_delete
  ON public.family_recipe_step_ingredients;
CREATE POLICY family_recipe_step_ingredients_delete
  ON public.family_recipe_step_ingredients
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.family_recipe_steps s
      WHERE s.id = step_id
        AND public.family_recipe_is_accessible(s.recipe_id)
    )
  );

-- Backfill structured ingredients from free-text lines.
INSERT INTO public.family_recipe_ingredients (
  recipe_id,
  sort_order,
  name,
  amount,
  unit,
  original_text
)
SELECT
  r.id,
  ordinality::integer - 1,
  NULLIF(btrim(line), '') AS name,
  NULL,
  NULL,
  btrim(line) AS original_text
FROM public.family_recipes r
CROSS JOIN LATERAL unnest(COALESCE(r.ingredients, '{}'::text[]))
  WITH ORDINALITY AS u(line, ordinality)
WHERE btrim(line) <> ''
  AND NOT EXISTS (
    SELECT 1
    FROM public.family_recipe_ingredients existing
    WHERE existing.recipe_id = r.id
  );

-- Backfill method as a single step so recipes stay usable immediately.
INSERT INTO public.family_recipe_steps (
  recipe_id,
  sort_order,
  title,
  content,
  timer_seconds
)
SELECT
  r.id,
  1,
  'Method',
  COALESCE(NULLIF(btrim(r.instructions), ''), 'No instructions yet.'),
  NULL
FROM public.family_recipes r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.family_recipe_steps existing
  WHERE existing.recipe_id = r.id
);

NOTIFY pgrst, 'reload schema';
