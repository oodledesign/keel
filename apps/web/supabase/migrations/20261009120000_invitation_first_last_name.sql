-- Optional invitee names on team invitations (prefill profile on accept).

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text;

COMMENT ON COLUMN public.invitations.first_name IS
  'Invitee first name; copied to user_settings on accept when empty.';

COMMENT ON COLUMN public.invitations.last_name IS
  'Invitee last name; copied to user_settings on accept when empty.';

CREATE OR REPLACE FUNCTION public.attach_invitation_names(
  account_slug text,
  links jsonb
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_account_id uuid;
  link jsonb;
  invite_email text;
  invite_first text;
  invite_last text;
BEGIN
  SELECT id
  INTO target_account_id
  FROM public.accounts
  WHERE slug = attach_invitation_names.account_slug;

  IF target_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found for slug %', account_slug;
  END IF;

  FOR link IN SELECT * FROM jsonb_array_elements(COALESCE(links, '[]'::jsonb))
  LOOP
    invite_email := lower(trim(COALESCE(link->>'email', '')));
    invite_first := nullif(trim(COALESCE(link->>'first_name', '')), '');
    invite_last := nullif(trim(COALESCE(link->>'last_name', '')), '');

    IF invite_email = '' THEN
      CONTINUE;
    END IF;

    UPDATE public.invitations
    SET
      first_name = invite_first,
      last_name = invite_last
    WHERE account_id = target_account_id
      AND lower(email) = invite_email;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_invitation_names(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_invitation_names(text, jsonb) TO service_role;

-- Accept invitation: copy seat_kind + invitee names onto membership / profile.
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
  target_seat_kind text;
  target_first_name text;
  target_last_name text;
BEGIN
  SELECT
    account_id,
    role,
    project_id,
    seat_kind,
    first_name,
    last_name
  INTO
    target_account_id,
    target_role,
    target_project_id,
    target_seat_kind,
    target_first_name,
    target_last_name
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

  IF target_seat_kind IS NULL OR target_seat_kind NOT IN ('billable', 'support') THEN
    target_seat_kind := 'billable';
  END IF;

  INSERT INTO public.accounts_memberships (
    user_id,
    account_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed,
    seat_kind
  )
  VALUES (
    accept_invitation.user_id,
    target_account_id,
    target_role,
    target_company_role,
    1,
    false,
    target_seat_kind
  );

  IF target_first_name IS NOT NULL OR target_last_name IS NOT NULL THEN
    INSERT INTO public.user_settings (user_id, first_name, last_name)
    VALUES (
      accept_invitation.user_id,
      target_first_name,
      target_last_name
    )
    ON CONFLICT (user_id) DO UPDATE
      SET
        first_name = COALESCE(
          NULLIF(trim(public.user_settings.first_name), ''),
          EXCLUDED.first_name
        ),
        last_name = COALESCE(
          NULLIF(trim(public.user_settings.last_name), ''),
          EXCLUDED.last_name
        );

    UPDATE public.accounts
    SET name = trim(
      concat_ws(
        ' ',
        COALESCE(target_first_name, ''),
        COALESCE(target_last_name, '')
      )
    )
    WHERE id = accept_invitation.user_id
      AND (
        name IS NULL
        OR trim(name) = ''
        OR name = (
          SELECT email FROM auth.users WHERE id = accept_invitation.user_id
        )
      )
      AND trim(
        concat_ws(
          ' ',
          COALESCE(target_first_name, ''),
          COALESCE(target_last_name, '')
        )
      ) <> '';
  END IF;

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
