-- Contact-level client portal visibility for projects.
-- Default (portal_restrict_contacts = false): every portal-enabled contact
-- for the linked client can see a portal_visible project — same as today.
-- When restricted, only contacts in project_portal_contacts can see it.
-- Enforcement lives in is_portal_visible_project so list + deep links +
-- tasks/comments all go through the same RLS gate.

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS portal_restrict_contacts boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.portal_restrict_contacts IS
  'When false (default), all portal contacts for the linked client can see a portal_visible project. When true, only contacts listed in project_portal_contacts can see it.';

CREATE TABLE IF NOT EXISTS public.project_portal_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, contact_id)
);

CREATE INDEX IF NOT EXISTS ix_project_portal_contacts_project_id
  ON public.project_portal_contacts (project_id);

CREATE INDEX IF NOT EXISTS ix_project_portal_contacts_contact_id
  ON public.project_portal_contacts (contact_id);

COMMENT ON TABLE public.project_portal_contacts IS
  'Allowlist of CRM contacts who may see a project in the client portal when projects.portal_restrict_contacts is true.';

-- ---------------------------------------------------------------------------
-- Integrity: allowlisted contacts must belong to the project's client
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.project_portal_contacts_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_client_id uuid;
  v_account_id uuid;
  v_contact_account uuid;
BEGIN
  SELECT p.client_id, p.account_id
    INTO v_client_id, v_account_id
  FROM public.projects p
  WHERE p.id = NEW.project_id;

  IF v_client_id IS NULL THEN
    RAISE EXCEPTION 'Project must be linked to a client before assigning portal contacts';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.client_contacts cc
    WHERE cc.client_id = v_client_id
      AND cc.contact_id = NEW.contact_id
  ) THEN
    RAISE EXCEPTION 'Contact is not linked to this project''s client';
  END IF;

  SELECT ct.account_id
    INTO v_contact_account
  FROM public.contacts ct
  WHERE ct.id = NEW.contact_id;

  IF v_contact_account IS NOT NULL
    AND v_contact_account IS DISTINCT FROM v_account_id
  THEN
    RAISE EXCEPTION 'Contact belongs to a different workspace';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_portal_contacts_validate
  ON public.project_portal_contacts;
CREATE TRIGGER project_portal_contacts_validate
  BEFORE INSERT OR UPDATE ON public.project_portal_contacts
  FOR EACH ROW
  EXECUTE FUNCTION public.project_portal_contacts_validate();

-- Drop stale allowlist rows when the project is reassigned to another client.
CREATE OR REPLACE FUNCTION public.projects_clear_stale_portal_contacts()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_id IS DISTINCT FROM OLD.client_id THEN
    DELETE FROM public.project_portal_contacts
    WHERE project_id = NEW.id
      AND (
        NEW.client_id IS NULL
        OR contact_id NOT IN (
          SELECT cc.contact_id
          FROM public.client_contacts cc
          WHERE cc.client_id = NEW.client_id
        )
      );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS projects_clear_stale_portal_contacts ON public.projects;
CREATE TRIGGER projects_clear_stale_portal_contacts
  AFTER UPDATE OF client_id ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.projects_clear_stale_portal_contacts();

-- ---------------------------------------------------------------------------
-- Match a portal login to a CRM contact (email + accepted invite)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.portal_contact_matches_user(
  target_contact_id uuid,
  target_user_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.contacts ct
    JOIN auth.users u ON u.id = target_user_id
    WHERE ct.id = target_contact_id
      AND (
        (
          ct.email IS NOT NULL
          AND u.email IS NOT NULL
          AND lower(trim(ct.email)) = lower(trim(u.email))
        )
        OR EXISTS (
          SELECT 1
          FROM public.contact_email_addresses cea
          WHERE cea.contact_id = ct.id
            AND u.email IS NOT NULL
            AND lower(trim(cea.email)) = lower(trim(u.email))
        )
        OR EXISTS (
          SELECT 1
          FROM public.client_portal_invites cpi
          WHERE cpi.contact_id = ct.id
            AND cpi.user_id = target_user_id
            AND cpi.status = 'accepted'
        )
      )
  );
$$;

COMMENT ON FUNCTION public.portal_contact_matches_user(uuid, uuid) IS
  'True when the auth user is the given CRM contact (primary/extra email or accepted portal invite).';

-- Called only from SECURITY DEFINER helpers. Do not grant to authenticated
-- (would let any login probe contact ↔ user matches).
GRANT EXECUTE ON FUNCTION public.portal_contact_matches_user(uuid, uuid)
  TO service_role;

-- ---------------------------------------------------------------------------
-- RLS helper: portal_visible + org membership + optional contact allowlist
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.is_portal_visible_project(target_project_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.projects p
    LEFT JOIN public.clients c ON c.id = p.client_id
    JOIN public.client_members cm
      ON cm.client_org_id = COALESCE(p.client_org_id, c.client_org_id)
    WHERE p.id = target_project_id
      AND p.portal_visible = true
      AND cm.user_id = (SELECT auth.uid())
      AND (
        COALESCE(p.portal_restrict_contacts, false) = false
        OR EXISTS (
          SELECT 1
          FROM public.project_portal_contacts ppc
          JOIN public.client_contacts cc ON cc.contact_id = ppc.contact_id
          WHERE ppc.project_id = p.id
            AND (p.client_id IS NULL OR cc.client_id = p.client_id)
            AND public.portal_contact_matches_user(ppc.contact_id, cm.user_id)
        )
      )
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_portal_visible_project(uuid)
  TO authenticated, service_role;

-- ---------------------------------------------------------------------------
-- RLS: workspace members only (portal contacts never read the allowlist)
-- ---------------------------------------------------------------------------

ALTER TABLE public.project_portal_contacts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE public.project_portal_contacts FROM authenticated, service_role;
GRANT SELECT, INSERT, DELETE ON TABLE public.project_portal_contacts
  TO authenticated, service_role;

DROP POLICY IF EXISTS project_portal_contacts_select ON public.project_portal_contacts;
CREATE POLICY project_portal_contacts_select
  ON public.project_portal_contacts
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_portal_contacts.project_id
        AND public.has_role_on_account(p.account_id)
    )
  );

DROP POLICY IF EXISTS project_portal_contacts_insert ON public.project_portal_contacts;
CREATE POLICY project_portal_contacts_insert
  ON public.project_portal_contacts
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_portal_contacts.project_id
        AND public.has_role_on_account(p.account_id)
    )
  );

DROP POLICY IF EXISTS project_portal_contacts_delete ON public.project_portal_contacts;
CREATE POLICY project_portal_contacts_delete
  ON public.project_portal_contacts
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = project_portal_contacts.project_id
        AND public.has_role_on_account(p.account_id)
    )
  );

NOTIFY pgrst, 'reload schema';
