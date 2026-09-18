-- Family Memories: dated kid notes (reuse public.notes) with household
-- children, an event date, and optional photo/video docs on the note.

-- ---------------------------------------------------------------------------
-- Household members: child profile fields (shared with meal-plan cooks)
-- ---------------------------------------------------------------------------

ALTER TABLE public.family_household_members
  ADD COLUMN IF NOT EXISTS date_of_birth date,
  ADD COLUMN IF NOT EXISTS avatar_path text,
  ADD COLUMN IF NOT EXISTS is_child boolean NOT NULL DEFAULT false;

ALTER TABLE public.family_household_members
  DROP CONSTRAINT IF EXISTS family_household_members_avatar_path_len;
ALTER TABLE public.family_household_members
  ADD CONSTRAINT family_household_members_avatar_path_len
    CHECK (avatar_path IS NULL OR char_length(avatar_path) <= 500);

COMMENT ON COLUMN public.family_household_members.date_of_birth IS
  'Optional date of birth for child profiles and age display.';
COMMENT ON COLUMN public.family_household_members.avatar_path IS
  'Optional storage path in account-documents for a child avatar.';
COMMENT ON COLUMN public.family_household_members.is_child IS
  'When true, this household member appears on Family Memories child profiles.';

CREATE INDEX IF NOT EXISTS ix_family_household_members_children
  ON public.family_household_members (account_id)
  WHERE is_child AND account_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Notes: event date (harmless on non-family notes)
-- ---------------------------------------------------------------------------

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS occurred_at date;

COMMENT ON COLUMN public.notes.occurred_at IS
  'Calendar date the note refers to (family memories). Null means use created_at.';

CREATE INDEX IF NOT EXISTS ix_notes_account_memory_occurred
  ON public.notes (account_id, occurred_at DESC NULLS LAST, created_at DESC)
  WHERE category = 'memory';

-- ---------------------------------------------------------------------------
-- Docs: optional link back to a note (memory photos/videos)
-- ---------------------------------------------------------------------------

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS note_id uuid REFERENCES public.notes (id)
    ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_docs_note_id
  ON public.docs (note_id)
  WHERE note_id IS NOT NULL;

COMMENT ON COLUMN public.docs.note_id IS
  'When set, this uploaded file is attached to a workspace note (family memories).';

-- ---------------------------------------------------------------------------
-- Memory ↔ children join
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.family_memory_children (
  note_id uuid NOT NULL REFERENCES public.notes (id) ON DELETE CASCADE,
  household_member_id uuid NOT NULL
    REFERENCES public.family_household_members (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (note_id, household_member_id)
);

CREATE INDEX IF NOT EXISTS ix_family_memory_children_member
  ON public.family_memory_children (household_member_id);

COMMENT ON TABLE public.family_memory_children IS
  'Assigns family memory notes to one or more household children.';

ALTER TABLE public.family_memory_children ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.family_memory_children
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.family_memory_children_same_account()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  note_account uuid;
  member_account uuid;
BEGIN
  SELECT n.account_id INTO note_account
  FROM public.notes n
  WHERE n.id = NEW.note_id;

  SELECT m.account_id INTO member_account
  FROM public.family_household_members m
  WHERE m.id = NEW.household_member_id;

  IF note_account IS NULL OR member_account IS NULL
     OR note_account IS DISTINCT FROM member_account THEN
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
    AND public.family_household_member_is_accessible(household_member_id)
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
    AND public.family_household_member_is_accessible(household_member_id)
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
    AND public.family_household_member_is_accessible(household_member_id)
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
    AND public.family_household_member_is_accessible(household_member_id)
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
    AND public.family_household_member_is_accessible(household_member_id)
  );

-- ---------------------------------------------------------------------------
-- Seed memory category + memories module for family accounts
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.seed_family_memory_categories(
  p_account_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  INSERT INTO public.note_categories (account_id, slug, label)
  VALUES (p_account_id, 'memory', 'Memory')
  ON CONFLICT (account_id, slug) DO NOTHING;
END;
$$;

REVOKE ALL ON FUNCTION public.seed_family_memory_categories(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.seed_family_memory_categories(uuid)
  TO service_role;

CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT 'work',
  p_business_type text DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'memories', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'forms', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  ELSIF normalized_space = 'building-surveyor' THEN
    keys := ARRAY[
      'dashboard', 'pipeline', 'forms', 'clients', 'meetings', 'surveys',
      'proposals', 'contracts', 'invoices', 'notes', 'docs', 'tasks', 'team',
      'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'forms', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys
  LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;

  IF normalized_space = 'family' THEN
    PERFORM public.seed_family_memory_categories(p_account_id);
  END IF;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'memories', true
FROM public.accounts a
WHERE a.space_type = 'family'
ON CONFLICT (account_id, module_key) DO NOTHING;

INSERT INTO public.note_categories (account_id, slug, label)
SELECT a.id, 'memory', 'Memory'
FROM public.accounts a
WHERE a.space_type = 'family'
ON CONFLICT (account_id, slug) DO NOTHING;
