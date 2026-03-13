-- Ensure invitations created for role = 'client' set company_role = 'client'
-- and not the default 'staff_member'. This keeps accounts_memberships.company_role
-- in sync when invitations are accepted.

-- 1) Update existing invitations so role/client pairs are consistent
UPDATE public.invitations
SET company_role = 'client'
WHERE role = 'client';

-- 2) Override add_invitations_to_account to always set company_role
CREATE OR REPLACE FUNCTION public.add_invitations_to_account (
  account_slug text,
  invitations public.invitation[],
  invited_by uuid
) RETURNS public.invitations[]
SET search_path = ''
LANGUAGE plpgsql
AS $$
DECLARE
  new_invitation public.invitations;
  all_invitations public.invitations[] := array[]::public.invitations[];
  invite_token text;
  email text;
  role varchar(50);
  company_role text;
BEGIN
  FOREACH email, role IN ARRAY invitations LOOP
    invite_token := extensions.uuid_generate_v4();

    company_role := CASE
      WHEN role = 'owner' THEN 'admin'
      WHEN role = 'admin' THEN 'admin'
      WHEN role = 'client' THEN 'client'
      WHEN role = 'contractor' THEN 'contractor'
      ELSE 'staff_member'
    END;

    INSERT INTO public.invitations (
      email,
      account_id,
      invited_by,
      role,
      company_role,
      invite_token
    )
    VALUES (
      email,
      (
        SELECT id
        FROM public.accounts
        WHERE slug = account_slug
      ),
      invited_by,
      role,
      company_role,
      invite_token
    )
    RETURNING * INTO new_invitation;

    all_invitations := array_append(all_invitations, new_invitation);
  END LOOP;

  RETURN all_invitations;
END;
$$;

