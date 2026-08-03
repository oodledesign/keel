-- Optional project assignment on team invitations.
-- When an invite includes a project_id, accepting it also adds the user to
-- that project's assignments (team member + project access).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.invitations.project_id IS
  'Optional project to assign the invitee to when they accept the team invitation.';

CREATE INDEX IF NOT EXISTS ix_invitations_project_id
  ON public.invitations (project_id)
  WHERE project_id IS NOT NULL;

-- Accept invitation: join account, then optionally assign to project.
-- Matches production membership columns (company_role / onboarding).
CREATE OR REPLACE FUNCTION public.accept_invitation(token text, user_id uuid)
RETURNS uuid
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  target_account_id uuid;
  target_role varchar(50);
  target_project_id uuid;
  target_company_role text;
BEGIN
  SELECT
    account_id,
    role,
    project_id
  INTO
    target_account_id,
    target_role,
    target_project_id
  FROM public.invitations
  WHERE invite_token = token
    AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  target_company_role := CASE
    WHEN target_role IN ('owner', 'admin') THEN 'admin'
    WHEN target_role = 'client' THEN 'client'
    WHEN target_role = 'contractor' THEN 'contractor'
    ELSE 'staff_member'
  END;

  INSERT INTO public.accounts_memberships (
    user_id,
    account_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed
  )
  VALUES (
    accept_invitation.user_id,
    target_account_id,
    target_role,
    target_company_role,
    1,
    false
  );

  IF target_project_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = target_project_id
        AND p.account_id = target_account_id
    ) THEN
      INSERT INTO public.project_assignments (
        project_id,
        user_id,
        account_id,
        role_on_project
      )
      VALUES (
        target_project_id,
        accept_invitation.user_id,
        target_account_id,
        target_role
      )
      ON CONFLICT (project_id, user_id) DO UPDATE
        SET account_id = EXCLUDED.account_id,
            role_on_project = COALESCE(
              EXCLUDED.role_on_project,
              public.project_assignments.role_on_project
            );
    END IF;
  END IF;

  DELETE FROM public.invitations
  WHERE invite_token = token;

  RETURN target_account_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid) TO service_role;

-- Attach optional project_ids after invitations are created via (email, role) RPC.
CREATE OR REPLACE FUNCTION public.attach_invitation_projects(
  account_slug text,
  links jsonb
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_account_id uuid;
  link jsonb;
  invite_email text;
  invite_project uuid;
BEGIN
  SELECT id
  INTO target_account_id
  FROM public.accounts
  WHERE slug = attach_invitation_projects.account_slug;

  IF target_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  FOR link IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(links, '[]'::jsonb))
  LOOP
    invite_email := lower(trim(COALESCE(link->>'email', '')));
    invite_project := NULLIF(trim(COALESCE(link->>'project_id', '')), '')::uuid;

    IF invite_email = '' OR invite_project IS NULL THEN
      CONTINUE;
    END IF;

    IF NOT EXISTS (
      SELECT 1
      FROM public.projects p
      WHERE p.id = invite_project
        AND p.account_id = target_account_id
    ) THEN
      CONTINUE;
    END IF;

    UPDATE public.invitations
    SET project_id = invite_project
    WHERE account_id = target_account_id
      AND lower(email) = invite_email;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_invitation_projects(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_invitation_projects(text, jsonb) TO service_role;
