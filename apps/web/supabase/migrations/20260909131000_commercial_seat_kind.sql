-- Commercial property: billable vs support seats on memberships and invitations.

ALTER TABLE public.accounts_memberships
  ADD COLUMN IF NOT EXISTS seat_kind text NOT NULL DEFAULT 'billable'
  CHECK (seat_kind IN ('billable', 'support'));

COMMENT ON COLUMN public.accounts_memberships.seat_kind IS
  'Commercial Property: billable seats count toward Stripe quantity; support seats use free allowance.';

ALTER TABLE public.invitations
  ADD COLUMN IF NOT EXISTS seat_kind text NOT NULL DEFAULT 'billable'
  CHECK (seat_kind IN ('billable', 'support'));

COMMENT ON COLUMN public.invitations.seat_kind IS
  'Copied onto accounts_memberships.seat_kind when the invitation is accepted.';

CREATE INDEX IF NOT EXISTS ix_accounts_memberships_seat_kind
  ON public.accounts_memberships (account_id, seat_kind);

CREATE INDEX IF NOT EXISTS ix_invitations_seat_kind
  ON public.invitations (account_id, seat_kind);

-- Allow seat_kind updates on memberships (alongside existing role/onboarding fields).
CREATE OR REPLACE FUNCTION kit.prevent_memberships_update () RETURNS trigger
SET search_path = ''
AS $$
BEGIN
  IF new.account_role IS DISTINCT FROM old.account_role
     OR new.company_role IS DISTINCT FROM old.company_role
     OR new.trade_role IS DISTINCT FROM old.trade_role
     OR new.onboarding_step IS DISTINCT FROM old.onboarding_step
     OR new.onboarding_completed IS DISTINCT FROM old.onboarding_completed
     OR new.seat_kind IS DISTINCT FROM old.seat_kind THEN
    RETURN new;
  END IF;

  RAISE EXCEPTION
    'Only account_role, company_role, trade_role, onboarding_step, onboarding_completed, and seat_kind can be updated';
END;
$$ LANGUAGE plpgsql;

-- Accept invitation: copy seat_kind onto membership.
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
BEGIN
  SELECT
    account_id,
    role,
    project_id,
    seat_kind
  INTO
    target_account_id,
    target_role,
    target_project_id,
    target_seat_kind
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

-- Attach seat_kind after invitations are created via (email, role) RPC.
CREATE OR REPLACE FUNCTION public.attach_invitation_seat_kinds(
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
  invite_seat_kind text;
BEGIN
  SELECT id
  INTO target_account_id
  FROM public.accounts
  WHERE slug = attach_invitation_seat_kinds.account_slug;

  IF target_account_id IS NULL THEN
    RAISE EXCEPTION 'Account not found';
  END IF;

  FOR link IN
    SELECT value
    FROM jsonb_array_elements(COALESCE(links, '[]'::jsonb))
  LOOP
    invite_email := lower(trim(COALESCE(link->>'email', '')));
    invite_seat_kind := lower(trim(COALESCE(link->>'seat_kind', 'billable')));

    IF invite_email = '' THEN
      CONTINUE;
    END IF;

    IF invite_seat_kind NOT IN ('billable', 'support') THEN
      invite_seat_kind := 'billable';
    END IF;

    UPDATE public.invitations
    SET seat_kind = invite_seat_kind
    WHERE account_id = target_account_id
      AND lower(email) = invite_email;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.attach_invitation_seat_kinds(text, jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.attach_invitation_seat_kinds(text, jsonb) TO service_role;
