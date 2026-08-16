-- Fix family_recipe_step_ingredients INSERT policy.
-- The previous policy ran two independent EXISTS checks, which allowed a user
-- who could access two different recipes to link a step from recipe A to an
-- ingredient from recipe B. This rewrites the INSERT and UPDATE policies so
-- that the step and ingredient must belong to the same recipe.

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

-- UPDATE also needs the same same-recipe guard for the new values.
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

NOTIFY pgrst, 'reload schema';
