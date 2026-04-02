-- accounts_memberships onboarding columns (needed by create_team_account RPC).
-- Safe when migration history was repaired without running 20260212000002.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'company_role'
  ) THEN
    ALTER TABLE public.accounts_memberships
      ADD COLUMN company_role text CHECK (company_role IN ('admin','staff_member','contractor','client'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'trade_role'
  ) THEN
    ALTER TABLE public.accounts_memberships ADD COLUMN trade_role text;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'onboarding_step'
  ) THEN
    ALTER TABLE public.accounts_memberships
      ADD COLUMN onboarding_step int NOT NULL DEFAULT 1 CHECK (onboarding_step BETWEEN 1 AND 6);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'accounts_memberships' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE public.accounts_memberships
      ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;
END$$;

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

NOTIFY pgrst, 'reload schema';
