-- Project team on the canvas: roles + descriptions for team members, external
-- contacts (client contacts, consultants) on a project, and doc / contact cards.

ALTER TABLE public.project_assignments
  ADD COLUMN IF NOT EXISTS description text;

ALTER TABLE public.project_assignments
  DROP CONSTRAINT IF EXISTS project_assignments_role_length,
  DROP CONSTRAINT IF EXISTS project_assignments_description_length;
ALTER TABLE public.project_assignments
  ADD CONSTRAINT project_assignments_role_length
    CHECK (role_on_project IS NULL OR char_length(role_on_project) <= 120) NOT VALID,
  ADD CONSTRAINT project_assignments_description_length
    CHECK (description IS NULL OR char_length(description) <= 1000);

DROP POLICY IF EXISTS project_assignments_update ON public.project_assignments;
CREATE POLICY project_assignments_update ON public.project_assignments
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assignments.project_id
        AND public.has_permission(auth.uid(), p.account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account(p.account_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_assignments.project_id
        AND public.has_permission(auth.uid(), p.account_id, 'jobs.edit'::public.app_permissions)
        AND NOT public.is_contractor_on_account(p.account_id)
    )
  );

GRANT UPDATE (role_on_project, description) ON public.project_assignments TO authenticated;

CREATE TABLE IF NOT EXISTS public.project_contacts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects (id) ON DELETE CASCADE,
  contact_id uuid NOT NULL REFERENCES public.contacts (id) ON DELETE CASCADE,
  role text CHECK (role IS NULL OR char_length(role) <= 120),
  description text CHECK (description IS NULL OR char_length(description) <= 1000),
  created_by uuid DEFAULT auth.uid() REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT project_contacts_unique UNIQUE (project_id, contact_id)
);

CREATE INDEX IF NOT EXISTS ix_project_contacts_contact
  ON public.project_contacts (contact_id);
CREATE INDEX IF NOT EXISTS ix_project_contacts_account
  ON public.project_contacts (account_id);

-- The project and contact must both belong to the row's account.
CREATE OR REPLACE FUNCTION public.project_contacts_validate()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = NEW.project_id AND p.account_id = NEW.account_id
  ) THEN
    RAISE EXCEPTION 'Project does not belong to this account';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.contacts c
    LEFT JOIN public.clients cl ON cl.id = c.client_id
    WHERE c.id = NEW.contact_id
      AND (
        c.account_id = NEW.account_id
        OR (c.account_id IS NULL AND cl.account_id = NEW.account_id)
      )
  ) THEN
    RAISE EXCEPTION 'Contact does not belong to this account';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS project_contacts_validate ON public.project_contacts;
CREATE TRIGGER project_contacts_validate
  BEFORE INSERT OR UPDATE ON public.project_contacts
  FOR EACH ROW EXECUTE FUNCTION public.project_contacts_validate();

ALTER TABLE public.project_contacts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS project_contacts_select ON public.project_contacts;
CREATE POLICY project_contacts_select ON public.project_contacts
  FOR SELECT TO authenticated
  USING (public.can_view_project_canvas(project_id));

DROP POLICY IF EXISTS project_contacts_insert ON public.project_contacts;
CREATE POLICY project_contacts_insert ON public.project_contacts
  FOR INSERT TO authenticated
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  );

DROP POLICY IF EXISTS project_contacts_update ON public.project_contacts;
CREATE POLICY project_contacts_update ON public.project_contacts
  FOR UPDATE TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  )
  WITH CHECK (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  );

DROP POLICY IF EXISTS project_contacts_delete ON public.project_contacts;
CREATE POLICY project_contacts_delete ON public.project_contacts
  FOR DELETE TO authenticated
  USING (
    public.can_edit_project_canvas(account_id)
    AND public.can_view_project_canvas(project_id)
  );

REVOKE ALL ON public.project_contacts FROM anon;
REVOKE UPDATE ON public.project_contacts FROM authenticated;
GRANT SELECT, INSERT, DELETE ON public.project_contacts TO authenticated;
GRANT UPDATE (role, description) ON public.project_contacts TO authenticated;
GRANT ALL ON public.project_contacts TO service_role;

-- Contact and doc cards on the canvas.
ALTER TABLE public.project_canvas_items
  DROP CONSTRAINT IF EXISTS project_canvas_items_kind_check,
  DROP CONSTRAINT IF EXISTS project_canvas_items_linked_ref;
ALTER TABLE public.project_canvas_items
  ADD CONSTRAINT project_canvas_items_kind_check CHECK (
    kind IN (
      'phase', 'task', 'member', 'client', 'note', 'contact', 'doc',
      'sticky', 'text', 'shape', 'frame', 'image', 'draw', 'connector'
    )
  ),
  ADD CONSTRAINT project_canvas_items_linked_ref CHECK (
    (kind IN ('phase', 'task', 'member', 'client', 'note', 'contact', 'doc'))
      = (ref_id IS NOT NULL)
  );

NOTIFY pgrst, 'reload schema';
