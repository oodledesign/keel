-- Shopping lists generated from a family meal-plan week.
-- Workspace-scoped like family_meal_plan_entries (account_id) with a personal fallback.

CREATE TABLE IF NOT EXISTS public.family_shopping_lists (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  skipped_meals text[] NOT NULL DEFAULT '{}',
  generated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_shopping_lists_account_week
  ON public.family_shopping_lists(account_id, week_start)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_shopping_lists_user_week
  ON public.family_shopping_lists(user_id, week_start)
  WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_family_shopping_lists_account
  ON public.family_shopping_lists(account_id, generated_at DESC)
  WHERE account_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_family_shopping_lists_user
  ON public.family_shopping_lists(user_id, generated_at DESC)
  WHERE account_id IS NULL;

COMMENT ON TABLE public.family_shopping_lists IS
  'One shopping list per family workspace (or personal user) per meal-plan week.';

CREATE TABLE IF NOT EXISTS public.family_shopping_list_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  list_id uuid NOT NULL REFERENCES public.family_shopping_lists(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  name text NOT NULL,
  amount numeric,
  unit text,
  category text NOT NULL DEFAULT 'other'
    CHECK (category IN ('produce', 'meat_fish', 'dairy', 'store_cupboard', 'other')),
  display_text text NOT NULL,
  is_unparsed boolean NOT NULL DEFAULT false,
  checked boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_family_shopping_list_items_list
  ON public.family_shopping_list_items(list_id, sort_order);

COMMENT ON TABLE public.family_shopping_list_items IS
  'Merged ingredient rows for a shopping list. Ticked state is persisted.';

DROP TRIGGER IF EXISTS family_shopping_lists_set_timestamps
  ON public.family_shopping_lists;
CREATE TRIGGER family_shopping_lists_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_shopping_lists
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS family_shopping_list_items_set_timestamps
  ON public.family_shopping_list_items;
CREATE TRIGGER family_shopping_list_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_shopping_list_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.family_shopping_lists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_shopping_list_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_shopping_lists
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_shopping_list_items
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.family_shopping_list_is_accessible(p_list_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_shopping_lists l
    WHERE l.id = p_list_id
      AND (
        (l.account_id IS NULL AND l.user_id = (SELECT auth.uid()))
        OR (l.account_id IS NOT NULL AND public.has_role_on_account(l.account_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.family_shopping_list_is_accessible(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.family_shopping_list_is_accessible(uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS family_shopping_lists_select ON public.family_shopping_lists;
CREATE POLICY family_shopping_lists_select ON public.family_shopping_lists
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_shopping_lists_insert ON public.family_shopping_lists;
CREATE POLICY family_shopping_lists_insert ON public.family_shopping_lists
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_shopping_lists_update ON public.family_shopping_lists;
CREATE POLICY family_shopping_lists_update ON public.family_shopping_lists
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_shopping_lists_delete ON public.family_shopping_lists;
CREATE POLICY family_shopping_lists_delete ON public.family_shopping_lists
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_shopping_list_items_select ON public.family_shopping_list_items;
CREATE POLICY family_shopping_list_items_select ON public.family_shopping_list_items
  FOR SELECT TO authenticated
  USING (public.family_shopping_list_is_accessible(list_id));

DROP POLICY IF EXISTS family_shopping_list_items_insert ON public.family_shopping_list_items;
CREATE POLICY family_shopping_list_items_insert ON public.family_shopping_list_items
  FOR INSERT TO authenticated
  WITH CHECK (public.family_shopping_list_is_accessible(list_id));

DROP POLICY IF EXISTS family_shopping_list_items_update ON public.family_shopping_list_items;
CREATE POLICY family_shopping_list_items_update ON public.family_shopping_list_items
  FOR UPDATE TO authenticated
  USING (public.family_shopping_list_is_accessible(list_id))
  WITH CHECK (public.family_shopping_list_is_accessible(list_id));

DROP POLICY IF EXISTS family_shopping_list_items_delete ON public.family_shopping_list_items;
CREATE POLICY family_shopping_list_items_delete ON public.family_shopping_list_items
  FOR DELETE TO authenticated
  USING (public.family_shopping_list_is_accessible(list_id));

NOTIFY pgrst, 'reload schema';
