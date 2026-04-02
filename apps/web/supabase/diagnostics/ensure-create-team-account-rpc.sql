-- Fix: PGRST202 / "Could not find create_team_account(account_name, account_slug, user_id)"
-- Usually the DB only has the legacy 1-arg function, or the 3-arg RPC was never applied
-- (e.g. after migration repair without running SQL).
--
-- Run in Supabase SQL Editor. Requires accounts_memberships columns:
-- company_role, onboarding_step, onboarding_completed (from onboarding migrations).

DROP FUNCTION IF EXISTS public.create_team_account(text);

CREATE OR REPLACE FUNCTION public.create_team_account(
  account_name text,
  user_id uuid,
  account_slug text DEFAULT NULL
)
RETURNS public.accounts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  new_account public.accounts;
  owner_role varchar(50);
BEGIN
  IF NOT public.is_set('enable_team_accounts') THEN
    RAISE EXCEPTION 'Team accounts are not enabled';
  END IF;

  SELECT public.get_upper_system_role() INTO owner_role;

  INSERT INTO public.accounts (name, slug, is_personal_account, primary_owner_user_id)
  VALUES (account_name, account_slug, false, user_id)
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

REVOKE ALL ON FUNCTION public.create_team_account(text, uuid, text) FROM public, authenticated;
GRANT EXECUTE ON FUNCTION public.create_team_account(text, uuid, text) TO service_role;

NOTIFY pgrst, 'reload schema';
