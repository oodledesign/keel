-- Expand family meal planning: pantry, household members + dietary,
-- cook assignment, batch leftovers, shopping pantry flags, book editors.
-- Additive only — existing plans and shopping lists keep working.

-- ---------------------------------------------------------------------------
-- Meal plan entries: cook, batch prep, leftover source
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_meal_plan_entries
  ADD COLUMN IF NOT EXISTS cook_member_id uuid,
  ADD COLUMN IF NOT EXISTS is_batch_prep boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS leftover_source_entry_id uuid;

ALTER TABLE public.family_meal_plan_entries
  DROP CONSTRAINT IF EXISTS family_meal_plan_entries_leftover_source_fk;
ALTER TABLE public.family_meal_plan_entries
  ADD CONSTRAINT family_meal_plan_entries_leftover_source_fk
    FOREIGN KEY (leftover_source_entry_id)
    REFERENCES public.family_meal_plan_entries (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_family_meal_plan_entries_leftover_source
  ON public.family_meal_plan_entries (leftover_source_entry_id)
  WHERE leftover_source_entry_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_family_meal_plan_entries_cook_member
  ON public.family_meal_plan_entries (cook_member_id)
  WHERE cook_member_id IS NOT NULL;

COMMENT ON COLUMN public.family_meal_plan_entries.cook_member_id IS
  'Household member assigned to cook this slot.';
COMMENT ON COLUMN public.family_meal_plan_entries.is_batch_prep IS
  'When true, this cook is a batch/prep that can feed leftover days.';
COMMENT ON COLUMN public.family_meal_plan_entries.leftover_source_entry_id IS
  'When set, this slot is leftovers from the referenced cook and is skipped for shopping.';

-- ---------------------------------------------------------------------------
-- Shopping items: pantry / excluded
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_shopping_list_items
  ADD COLUMN IF NOT EXISTS in_pantry boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS excluded boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.family_shopping_list_items.in_pantry IS
  'True when the item matches a pantry / we-have-this entry.';
COMMENT ON COLUMN public.family_shopping_list_items.excluded IS
  'True when the shopper chose not to buy this item.';

-- ---------------------------------------------------------------------------
-- Recipe books: last editor (household co-edit presence after refresh)
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_recipe_books
  ADD COLUMN IF NOT EXISTS last_edited_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS last_edited_name text;

ALTER TABLE public.family_recipe_books
  DROP CONSTRAINT IF EXISTS family_recipe_books_last_edited_name_len;
ALTER TABLE public.family_recipe_books
  ADD CONSTRAINT family_recipe_books_last_edited_name_len
    CHECK (
      last_edited_name IS NULL OR char_length(last_edited_name) <= 120
    );

COMMENT ON COLUMN public.family_recipe_books.last_edited_by IS
  'Auth user who last saved this book (workspace members share the book).';
COMMENT ON COLUMN public.family_recipe_books.last_edited_name IS
  'Display name cached at save time for the last editor.';

-- ---------------------------------------------------------------------------
-- Household members (named cooks + per-person dietary)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_household_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  display_name text NOT NULL,
  member_user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  dietary_tags text[] NOT NULL DEFAULT '{}'::text[],
  excluded_ingredients text[] NOT NULL DEFAULT '{}'::text[],
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_household_members_name_len
    CHECK (char_length(btrim(display_name)) > 0 AND char_length(display_name) <= 80)
);

CREATE INDEX IF NOT EXISTS ix_family_household_members_user_id
  ON public.family_household_members (user_id)
  WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_family_household_members_account_id
  ON public.family_household_members (account_id)
  WHERE account_id IS NOT NULL;

COMMENT ON TABLE public.family_household_members IS
  'Named household cooks with dietary tags. Personal when account_id is null.';

DROP TRIGGER IF EXISTS family_household_members_set_timestamps
  ON public.family_household_members;
CREATE TRIGGER family_household_members_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_household_members
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.family_meal_plan_entries
  DROP CONSTRAINT IF EXISTS family_meal_plan_entries_cook_member_fk;
ALTER TABLE public.family_meal_plan_entries
  ADD CONSTRAINT family_meal_plan_entries_cook_member_fk
    FOREIGN KEY (cook_member_id)
    REFERENCES public.family_household_members (id)
    ON DELETE SET NULL;

-- ---------------------------------------------------------------------------
-- Pantry / we have this
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_pantry_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  account_id uuid REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  normalized_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT family_pantry_items_name_len
    CHECK (char_length(btrim(name)) > 0 AND char_length(name) <= 120),
  CONSTRAINT family_pantry_items_notes_len
    CHECK (notes IS NULL OR char_length(notes) <= 400)
);

CREATE INDEX IF NOT EXISTS ix_family_pantry_items_user_id
  ON public.family_pantry_items (user_id, normalized_name)
  WHERE account_id IS NULL;

CREATE INDEX IF NOT EXISTS ix_family_pantry_items_account_id
  ON public.family_pantry_items (account_id, normalized_name)
  WHERE account_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_pantry_items_personal_name
  ON public.family_pantry_items (user_id, normalized_name)
  WHERE account_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_family_pantry_items_account_name
  ON public.family_pantry_items (account_id, normalized_name)
  WHERE account_id IS NOT NULL;

COMMENT ON TABLE public.family_pantry_items IS
  'Ingredients the household already has. Used to dim or skip shopping items.';

DROP TRIGGER IF EXISTS family_pantry_items_set_timestamps
  ON public.family_pantry_items;
CREATE TRIGGER family_pantry_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.family_pantry_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_household_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.family_pantry_items ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_household_members
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_pantry_items
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.family_household_member_is_accessible(
  p_member_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.family_household_members m
    WHERE m.id = p_member_id
      AND (
        (m.account_id IS NULL AND m.user_id = (SELECT auth.uid()))
        OR (m.account_id IS NOT NULL AND public.has_role_on_account(m.account_id))
      )
  );
$$;

REVOKE ALL ON FUNCTION public.family_household_member_is_accessible(uuid)
  FROM public;
GRANT EXECUTE ON FUNCTION public.family_household_member_is_accessible(uuid)
  TO authenticated, service_role;

DROP POLICY IF EXISTS family_household_members_select
  ON public.family_household_members;
CREATE POLICY family_household_members_select ON public.family_household_members
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_household_members_insert
  ON public.family_household_members;
CREATE POLICY family_household_members_insert ON public.family_household_members
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_household_members_update
  ON public.family_household_members;
CREATE POLICY family_household_members_update ON public.family_household_members
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_household_members_delete
  ON public.family_household_members;
CREATE POLICY family_household_members_delete ON public.family_household_members
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_pantry_items_select ON public.family_pantry_items;
CREATE POLICY family_pantry_items_select ON public.family_pantry_items
  FOR SELECT TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_pantry_items_insert ON public.family_pantry_items;
CREATE POLICY family_pantry_items_insert ON public.family_pantry_items
  FOR INSERT TO authenticated
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_pantry_items_update ON public.family_pantry_items;
CREATE POLICY family_pantry_items_update ON public.family_pantry_items
  FOR UPDATE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  )
  WITH CHECK (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );

DROP POLICY IF EXISTS family_pantry_items_delete ON public.family_pantry_items;
CREATE POLICY family_pantry_items_delete ON public.family_pantry_items
  FOR DELETE TO authenticated
  USING (
    (account_id IS NULL AND user_id = (SELECT auth.uid()))
    OR (account_id IS NOT NULL AND public.has_role_on_account(account_id))
  );
