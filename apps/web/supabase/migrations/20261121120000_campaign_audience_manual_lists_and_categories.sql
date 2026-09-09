-- Campaigns audience upgrades:
-- * Manual (static) lists with explicit contact membership
-- * Workspace-scoped contact categories (assignable, soft-disable)
-- * Optional company_name on CRM contacts (CSV / list filters)
-- * Account members can update/delete workspace contacts (needed for Campaigns → Contacts)

-- ---------------------------------------------------------------------------
-- Contacts: company name + member update/delete
-- ---------------------------------------------------------------------------
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS company_name text;

COMMENT ON COLUMN public.contacts.company_name IS
  'Optional organisation name on the person record (CSV import / campaign filters).';

DROP POLICY IF EXISTS contacts_update ON public.contacts;
CREATE POLICY contacts_update ON public.contacts
  FOR UPDATE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_account_member(account_id)
  )
  WITH CHECK (
    user_id = auth.uid()
    OR public.is_account_member(account_id)
  );

DROP POLICY IF EXISTS contacts_delete ON public.contacts;
CREATE POLICY contacts_delete ON public.contacts
  FOR DELETE TO authenticated
  USING (
    user_id = auth.uid()
    OR public.is_account_member(account_id)
  );

CREATE OR REPLACE FUNCTION public.protect_contacts_account_id()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF NEW.account_id IS DISTINCT FROM OLD.account_id THEN
    RAISE EXCEPTION 'account_id is immutable on contacts';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS contacts_protect_account_id ON public.contacts;
CREATE TRIGGER contacts_protect_account_id
BEFORE UPDATE ON public.contacts
FOR EACH ROW
EXECUTE FUNCTION public.protect_contacts_account_id();

-- ---------------------------------------------------------------------------
-- Saved lists: allow static/manual membership (keeps existing logic sources)
-- ---------------------------------------------------------------------------
ALTER TABLE public.campaign_audience_lists
  DROP CONSTRAINT IF EXISTS campaign_audience_lists_source_check;

ALTER TABLE public.campaign_audience_lists
  ADD CONSTRAINT campaign_audience_lists_source_check
  CHECK (source IN ('subscribers', 'clients', 'contacts', 'manual'));

COMMENT ON TABLE public.campaign_audience_lists IS
  'Growth+: named audience lists. source=manual is static membership; other sources use logic filters resolved at send time.';

CREATE TABLE IF NOT EXISTS public.campaign_audience_list_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  list_id uuid NOT NULL REFERENCES public.campaign_audience_lists (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_audience_list_members_unique UNIQUE (list_id, contact_id)
);

COMMENT ON TABLE public.campaign_audience_list_members IS
  'Static members of a manual campaign audience list. Always workspace CRM contacts.';

CREATE INDEX IF NOT EXISTS ix_campaign_audience_list_members_account
  ON public.campaign_audience_list_members (account_id, list_id);

CREATE INDEX IF NOT EXISTS ix_campaign_audience_list_members_contact
  ON public.campaign_audience_list_members (contact_id);

ALTER TABLE public.campaign_audience_list_members ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_audience_list_members FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_audience_list_members
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_audience_list_members_select
  ON public.campaign_audience_list_members;
CREATE POLICY campaign_audience_list_members_select
  ON public.campaign_audience_list_members
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_members_insert
  ON public.campaign_audience_list_members;
CREATE POLICY campaign_audience_list_members_insert
  ON public.campaign_audience_list_members
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_members_update
  ON public.campaign_audience_list_members;
CREATE POLICY campaign_audience_list_members_update
  ON public.campaign_audience_list_members
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_members_delete
  ON public.campaign_audience_list_members;
CREATE POLICY campaign_audience_list_members_delete
  ON public.campaign_audience_list_members
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_audience_list_members_service_role
  ON public.campaign_audience_list_members;
CREATE POLICY campaign_audience_list_members_service_role
  ON public.campaign_audience_list_members
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- ---------------------------------------------------------------------------
-- Contact categories (workspace-scoped tags)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.campaign_contact_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  name text NOT NULL,
  archived_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT campaign_contact_categories_name_len
    CHECK (char_length(trim(name)) BETWEEN 1 AND 80)
);

COMMENT ON TABLE public.campaign_contact_categories IS
  'Growth+: workspace-scoped contact categories for Campaigns lists and filters.';

CREATE UNIQUE INDEX IF NOT EXISTS ux_campaign_contact_categories_account_name
  ON public.campaign_contact_categories (account_id, lower(trim(name)))
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_campaign_contact_categories_account
  ON public.campaign_contact_categories (account_id, created_at DESC);

DROP TRIGGER IF EXISTS campaign_contact_categories_set_timestamps
  ON public.campaign_contact_categories;
CREATE TRIGGER campaign_contact_categories_set_timestamps
BEFORE INSERT OR UPDATE ON public.campaign_contact_categories
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.campaign_contact_categories ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_contact_categories FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_contact_categories
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_contact_categories_select
  ON public.campaign_contact_categories;
CREATE POLICY campaign_contact_categories_select
  ON public.campaign_contact_categories
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_categories_insert
  ON public.campaign_contact_categories;
CREATE POLICY campaign_contact_categories_insert
  ON public.campaign_contact_categories
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_categories_update
  ON public.campaign_contact_categories;
CREATE POLICY campaign_contact_categories_update
  ON public.campaign_contact_categories
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_categories_delete
  ON public.campaign_contact_categories;
CREATE POLICY campaign_contact_categories_delete
  ON public.campaign_contact_categories
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_categories_service_role
  ON public.campaign_contact_categories;
CREATE POLICY campaign_contact_categories_service_role
  ON public.campaign_contact_categories
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TABLE IF NOT EXISTS public.campaign_contact_category_assignments (
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  category_id uuid NOT NULL REFERENCES public.campaign_contact_categories (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (contact_id, category_id)
);

COMMENT ON TABLE public.campaign_contact_category_assignments IS
  'Links CRM contacts to Campaigns contact categories.';

CREATE INDEX IF NOT EXISTS ix_campaign_contact_category_assignments_account
  ON public.campaign_contact_category_assignments (account_id, category_id);

CREATE INDEX IF NOT EXISTS ix_campaign_contact_category_assignments_category
  ON public.campaign_contact_category_assignments (category_id);

ALTER TABLE public.campaign_contact_category_assignments ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.campaign_contact_category_assignments
  FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.campaign_contact_category_assignments
  TO authenticated, service_role;

DROP POLICY IF EXISTS campaign_contact_category_assignments_select
  ON public.campaign_contact_category_assignments;
CREATE POLICY campaign_contact_category_assignments_select
  ON public.campaign_contact_category_assignments
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_category_assignments_insert
  ON public.campaign_contact_category_assignments;
CREATE POLICY campaign_contact_category_assignments_insert
  ON public.campaign_contact_category_assignments
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_category_assignments_update
  ON public.campaign_contact_category_assignments;
CREATE POLICY campaign_contact_category_assignments_update
  ON public.campaign_contact_category_assignments
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_category_assignments_delete
  ON public.campaign_contact_category_assignments;
CREATE POLICY campaign_contact_category_assignments_delete
  ON public.campaign_contact_category_assignments
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS campaign_contact_category_assignments_service_role
  ON public.campaign_contact_category_assignments;
CREATE POLICY campaign_contact_category_assignments_service_role
  ON public.campaign_contact_category_assignments
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
