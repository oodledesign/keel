-- Add 'property' as a valid space_type for property management business workspaces.

-- 1. Widen the check constraint.
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_space_type_valid;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_space_type_valid CHECK (
  is_personal_account = true
  OR space_type IN ('work', 'family', 'community', 'property')
);

-- 2. Update the 4-arg create_team_account RPC to accept 'property'.
CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL,
  account_space_type text DEFAULT 'work'
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_account public.accounts;
  owner_role varchar(50);
  normalized_space_type text;
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  normalized_space_type := lower(coalesce(account_space_type, 'work'));

  IF normalized_space_type NOT IN ('work', 'family', 'community', 'property') THEN
    RAISE EXCEPTION 'Invalid account_space_type. Expected work, family, community, or property.';
  END IF;

  SELECT public.get_upper_system_role() INTO owner_role;

  INSERT INTO public.accounts (
    name,
    slug,
    is_personal_account,
    primary_owner_user_id,
    space_type
  )
  VALUES (
    account_name,
    account_slug,
    false,
    user_id,
    normalized_space_type
  )
  RETURNING * INTO new_account;

  INSERT INTO public.accounts_memberships (
    account_id,
    user_id,
    account_role,
    company_role,
    onboarding_step,
    onboarding_completed
  )
  VALUES (
    new_account.id,
    user_id,
    COALESCE(owner_role, 'owner'),
    'admin',
    1,
    false
  );

  RETURN new_account;
END;
$$;

REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text, text) TO service_role;

NOTIFY pgrst, 'reload schema';
