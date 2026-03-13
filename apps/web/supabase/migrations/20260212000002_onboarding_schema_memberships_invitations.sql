-- Onboarding: accounts_memberships and invitations columns, triggers, accept_invitation, create_team_account
-- Idempotent. Preserves referential integrity.

-- 1) Add columns to accounts_memberships (if not exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'company_role') THEN
    ALTER TABLE public.accounts_memberships
    ADD COLUMN company_role text CHECK (company_role IN ('admin','staff_member','contractor','client'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'trade_role') THEN
    ALTER TABLE public.accounts_memberships ADD COLUMN trade_role text;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'onboarding_step') THEN
    ALTER TABLE public.accounts_memberships ADD COLUMN onboarding_step int NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 6);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'onboarding_completed') THEN
    ALTER TABLE public.accounts_memberships ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;
END$$;

-- Backfill company_role and mark existing members as onboarding-completed (so we don't redirect them)
UPDATE public.accounts_memberships
SET
  company_role = CASE
    WHEN account_role = 'owner' THEN 'admin'
    WHEN account_role = 'admin' THEN 'admin'
    WHEN account_role = 'client' THEN 'client'
    ELSE 'staff_member'
  END,
  onboarding_completed = true
WHERE company_role IS NULL;

-- 2) Allow updates to new membership fields (prevent_memberships_update)
CREATE OR REPLACE FUNCTION kit.prevent_memberships_update() RETURNS trigger
SET search_path = ''
LANGUAGE plpgsql AS $$
BEGIN
  IF new.account_role IS DISTINCT FROM old.account_role
     OR new.company_role IS DISTINCT FROM old.company_role
     OR new.trade_role IS DISTINCT FROM old.trade_role
     OR new.onboarding_step IS DISTINCT FROM old.onboarding_step
     OR new.onboarding_completed IS DISTINCT FROM old.onboarding_completed THEN
    RETURN new;
  END IF;
  RAISE EXCEPTION 'Only account_role, company_role, trade_role, onboarding_step, and onboarding_completed can be updated';
END;
$$;

-- 2b) Fix any stale invitations.role that still references 'member' (role was renamed to 'staff')
UPDATE public.invitations SET role = 'staff' WHERE role = 'member';

-- 3) Add company_role to invitations (default staff_member for existing/new invites without persona)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'invitations' AND column_name = 'company_role') THEN
    ALTER TABLE public.invitations
    ADD COLUMN company_role text DEFAULT 'staff_member' CHECK (company_role IN ('admin','staff_member','contractor','client'));
  END IF;
END$$;

-- 4) accept_invitation: include company_role, onboarding_completed, onboarding_step
CREATE OR REPLACE FUNCTION public.accept_invitation(token text, user_id uuid) RETURNS uuid
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE
  target_account_id uuid;
  target_role varchar(50);
  target_company_role text;
BEGIN
  SELECT account_id, role, company_role
  INTO target_account_id, target_role, target_company_role
  FROM public.invitations
  WHERE invite_token = token AND expires_at > now();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invitation token';
  END IF;

  INSERT INTO public.accounts_memberships (
    user_id, account_id, account_role,
    company_role, onboarding_step, onboarding_completed
  )
  VALUES (
    accept_invitation.user_id,
    target_account_id,
    target_role,
    target_company_role,
    1,
    false
  );

  DELETE FROM public.invitations WHERE invite_token = token;
  RETURN target_account_id;
END;
$$;
GRANT EXECUTE ON FUNCTION public.accept_invitation(text, uuid) TO service_role;

-- 5) create_team_account: set company_role = 'admin', onboarding_step = 1, onboarding_completed = false for owner
CREATE OR REPLACE FUNCTION public.create_team_account(account_name text, user_id uuid, account_slug text DEFAULT NULL)
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
    account_id, user_id, account_role,
    company_role, onboarding_step, onboarding_completed
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
