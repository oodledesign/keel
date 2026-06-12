-- Share family meal planning across family workspace members (account-scoped rows).

ALTER TABLE public.family_recipes
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.family_meal_preferences
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

ALTER TABLE public.family_meal_plan_entries
  ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE;

-- Preferences: one row per user (personal) or one row per account (workspace).
ALTER TABLE public.family_meal_preferences
  DROP CONSTRAINT IF EXISTS family_meal_preferences_pkey;

ALTER TABLE public.family_meal_preferences
  ADD COLUMN IF NOT EXISTS id uuid DEFAULT gen_random_uuid();

UPDATE public.family_meal_preferences
SET id = gen_random_uuid()
WHERE id IS NULL;

ALTER TABLE public.family_meal_preferences
  ALTER COLUMN id SET NOT NULL;

ALTER TABLE public.family_meal_preferences
  ADD PRIMARY KEY (id);

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_meal_preferences_user
  ON public.family_meal_preferences(user_id)
  WHERE account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_meal_preferences_account
  ON public.family_meal_preferences(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_family_recipes_account_id
  ON public.family_recipes(account_id)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_family_meal_plan_entries_account_date
  ON public.family_meal_plan_entries(account_id, plan_date)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_meal_plan_entries_account
  ON public.family_meal_plan_entries(account_id, plan_date, meal_type)
  WHERE account_id IS NOT NULL;

-- ---------- RLS (personal OR workspace member) ----------
DROP POLICY IF EXISTS family_recipes_select ON public.family_recipes;
CREATE POLICY family_recipes_select ON public.family_recipes
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipes_insert ON public.family_recipes;
CREATE POLICY family_recipes_insert ON public.family_recipes
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipes_update ON public.family_recipes;
CREATE POLICY family_recipes_update ON public.family_recipes
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_recipes_delete ON public.family_recipes;
CREATE POLICY family_recipes_delete ON public.family_recipes
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_preferences_select ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_select ON public.family_meal_preferences
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_preferences_insert ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_insert ON public.family_meal_preferences
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_preferences_update ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_update ON public.family_meal_preferences
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_preferences_delete ON public.family_meal_preferences;
CREATE POLICY family_meal_preferences_delete ON public.family_meal_preferences
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_plan_entries_select ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_select ON public.family_meal_plan_entries
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_plan_entries_insert ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_insert ON public.family_meal_plan_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_plan_entries_update ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_update ON public.family_meal_plan_entries
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_meal_plan_entries_delete ON public.family_meal_plan_entries;
CREATE POLICY family_meal_plan_entries_delete ON public.family_meal_plan_entries
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

NOTIFY pgrst, 'reload schema';
