-- Memories children are People (`personal_people`), not meal-plan household
-- members. Family workspaces can share people; meal-plan cooks stay separate.

-- ---------------------------------------------------------------------------
-- People: child flag + family-workspace access
-- ---------------------------------------------------------------------------

ALTER TABLE public.personal_people
  ADD COLUMN IF NOT EXISTS is_child boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.personal_people.is_child IS
  'When true, this person appears as a child on Family Memories.';

CREATE INDEX IF NOT EXISTS ix_personal_people_account_children
  ON public.personal_people (account_id)
  WHERE is_child;

CREATE OR REPLACE FUNCTION public.personal_person_owned_by_user(p_person_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.personal_people p
    WHERE p.id = p_person_id
      AND (
        p.user_id = (SELECT auth.uid())
        OR public.has_role_on_account(p.account_id)
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.personal_person_owned_by_user(uuid)
  TO authenticated;

DROP POLICY IF EXISTS personal_people_select ON public.personal_people;
CREATE POLICY personal_people_select ON public.personal_people
  FOR SELECT TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS personal_people_insert ON public.personal_people;
CREATE POLICY personal_people_insert ON public.personal_people
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      EXISTS (
        SELECT 1
        FROM public.accounts a
        WHERE a.id = account_id
          AND a.is_personal_account = true
          AND a.primary_owner_user_id = (SELECT auth.uid())
      )
      OR (
        public.has_role_on_account(account_id)
        AND EXISTS (
          SELECT 1
          FROM public.accounts a
          WHERE a.id = account_id
            AND a.space_type = 'family'
        )
      )
    )
  );

DROP POLICY IF EXISTS personal_people_update ON public.personal_people;
CREATE POLICY personal_people_update ON public.personal_people
  FOR UPDATE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

DROP POLICY IF EXISTS personal_people_delete ON public.personal_people;
CREATE POLICY personal_people_delete ON public.personal_people
  FOR DELETE TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR public.has_role_on_account(account_id)
  );

-- ---------------------------------------------------------------------------
-- Memory children join: person_id instead of household_member_id
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS public.family_memory_children;

CREATE TABLE public.family_memory_children (
  note_id uuid NOT NULL REFERENCES public.notes (id) ON DELETE CASCADE,
  person_id uuid NOT NULL REFERENCES public.personal_people (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, person_id)
);

CREATE INDEX IF NOT EXISTS ix_family_memory_children_person
  ON public.family_memory_children (person_id);

COMMENT ON TABLE public.family_memory_children IS
  'Assigns family memory notes to one or more People records.';

ALTER TABLE public.family_memory_children ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_memory_children
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.family_memory_children_same_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
DECLARE
  note_account uuid;
  person_account uuid;
BEGIN
  SELECT n.account_id INTO note_account
  FROM public.notes n
  WHERE n.id = NEW.note_id;

  SELECT p.account_id INTO person_account
  FROM public.personal_people p
  WHERE p.id = NEW.person_id;

  IF note_account IS NULL OR person_account IS NULL
     OR note_account IS DISTINCT FROM person_account THEN
    RAISE EXCEPTION
      'Memory child must belong to the same family account as the note';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS family_memory_children_same_account
  ON public.family_memory_children;
CREATE TRIGGER family_memory_children_same_account
  BEFORE INSERT OR UPDATE ON public.family_memory_children
  FOR EACH ROW EXECUTE FUNCTION public.family_memory_children_same_account();

DROP POLICY IF EXISTS family_memory_children_select
  ON public.family_memory_children;
CREATE POLICY family_memory_children_select ON public.family_memory_children
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = note_id
        AND (
          public.is_account_owner(n.account_id)
          OR public.has_role_on_account(n.account_id)
        )
    )
    AND public.personal_person_owned_by_user(person_id)
  );

DROP POLICY IF EXISTS family_memory_children_insert
  ON public.family_memory_children;
CREATE POLICY family_memory_children_insert ON public.family_memory_children
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = note_id
        AND (
          public.is_account_owner(n.account_id)
          OR public.has_role_on_account(n.account_id)
        )
    )
    AND public.personal_person_owned_by_user(person_id)
  );

DROP POLICY IF EXISTS family_memory_children_update
  ON public.family_memory_children;
CREATE POLICY family_memory_children_update ON public.family_memory_children
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = note_id
        AND (
          public.is_account_owner(n.account_id)
          OR public.has_role_on_account(n.account_id)
        )
    )
    AND public.personal_person_owned_by_user(person_id)
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = note_id
        AND (
          public.is_account_owner(n.account_id)
          OR public.has_role_on_account(n.account_id)
        )
    )
    AND public.personal_person_owned_by_user(person_id)
  );

DROP POLICY IF EXISTS family_memory_children_delete
  ON public.family_memory_children;
CREATE POLICY family_memory_children_delete ON public.family_memory_children
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.notes n
      WHERE n.id = note_id
        AND (
          public.is_account_owner(n.account_id)
          OR public.has_role_on_account(n.account_id)
        )
    )
    AND public.personal_person_owned_by_user(person_id)
  );

-- ---------------------------------------------------------------------------
-- Meal-plan household: drop Memories-only child columns
-- ---------------------------------------------------------------------------

DROP INDEX IF EXISTS ix_family_household_members_children;

ALTER TABLE public.family_household_members
  DROP CONSTRAINT IF EXISTS family_household_members_avatar_path_len;

ALTER TABLE public.family_household_members
  DROP COLUMN IF EXISTS date_of_birth,
  DROP COLUMN IF EXISTS avatar_path,
  DROP COLUMN IF EXISTS is_child;
