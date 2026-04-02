-- Minimal bootstrap: only what's needed for "teams" / user_accounts to work.
-- Run this in Supabase SQL Editor if you do NOT want to run the full migration stack.
-- Use when: relation "public.accounts" does not exist, and you want to keep your existing DB.
--
-- This creates: config, roles, accounts, accounts_memberships, helper functions, RLS, user_accounts view.
-- It does NOT create: invitations, subscriptions, billing, notifications, storage policies, etc.
-- After running: create team accounts via the app (Create a team) or insert into accounts + accounts_memberships.
--
-- Idempotent: safe to run multiple times (IF NOT EXISTS / CREATE OR REPLACE).

-- 1) Config (required for is_set('enable_team_accounts'))
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'billing_provider') THEN
    CREATE TYPE public.billing_provider AS ENUM ('stripe', 'lemon-squeezy', 'paddle');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS public.config (
  enable_team_accounts boolean DEFAULT true NOT NULL,
  enable_account_billing boolean DEFAULT true NOT NULL,
  enable_team_account_billing boolean DEFAULT true NOT NULL,
  billing_provider public.billing_provider DEFAULT 'stripe' NOT NULL
);

INSERT INTO public.config (enable_team_accounts, enable_account_billing, enable_team_account_billing)
SELECT true, true, true
WHERE NOT EXISTS (SELECT 1 FROM public.config LIMIT 1);

ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS config_read ON public.config;
CREATE POLICY config_read ON public.config FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.config TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_set(field_name text) RETURNS boolean
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE result boolean;
BEGIN
  EXECUTE format('SELECT %I FROM public.config LIMIT 1', field_name) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.is_set(text) TO authenticated;

-- 2) Roles (accounts_memberships.account_role references this)
CREATE TABLE IF NOT EXISTS public.roles (
  name varchar(50) NOT NULL PRIMARY KEY,
  hierarchy_level int NOT NULL CHECK (hierarchy_level > 0),
  UNIQUE (hierarchy_level)
);

INSERT INTO public.roles (name, hierarchy_level) VALUES
  ('owner', 1),
  ('admin', 2),
  ('staff', 3)
ON CONFLICT (name) DO NOTHING;

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS roles_read ON public.roles;
CREATE POLICY roles_read ON public.roles FOR SELECT TO authenticated USING (true);
GRANT SELECT ON public.roles TO authenticated, service_role;

-- 3) Accounts
CREATE TABLE IF NOT EXISTS public.accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  primary_owner_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name varchar(255) NOT NULL,
  slug text UNIQUE,
  email varchar(320) UNIQUE,
  is_personal_account boolean NOT NULL DEFAULT false,
  updated_at timestamptz,
  created_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  picture_url varchar(1000),
  public_data jsonb NOT NULL DEFAULT '{}'
);

ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts TO authenticated, service_role;

-- Team accounts must have a slug; personal accounts must have null slug
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'accounts_slug_null_if_personal_account_true') THEN
    ALTER TABLE public.accounts ADD CONSTRAINT accounts_slug_null_if_personal_account_true
    CHECK (
      (is_personal_account = true AND slug IS NULL) OR (is_personal_account = false AND slug IS NOT NULL)
    );
  END IF;
END $$;

-- 4) Accounts memberships
CREATE TABLE IF NOT EXISTS public.accounts_memberships (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  account_role varchar(50) NOT NULL REFERENCES public.roles(name),
  created_at timestamptz NOT NULL DEFAULT current_timestamp,
  updated_at timestamptz NOT NULL DEFAULT current_timestamp,
  created_by uuid REFERENCES auth.users(id),
  updated_by uuid REFERENCES auth.users(id),
  PRIMARY KEY (user_id, account_id)
);

CREATE INDEX IF NOT EXISTS ix_accounts_memberships_account_id ON public.accounts_memberships(account_id);
CREATE INDEX IF NOT EXISTS ix_accounts_memberships_user_id ON public.accounts_memberships(user_id);
ALTER TABLE public.accounts_memberships ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.accounts_memberships TO authenticated, service_role;

-- 5) Helper functions for RLS
CREATE OR REPLACE FUNCTION public.has_role_on_account(account_id uuid, account_role varchar(50) DEFAULT NULL)
RETURNS boolean
SET search_path = ''
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.user_id = auth.uid()
      AND m.account_id = has_role_on_account.account_id
      AND (has_role_on_account.account_role IS NULL OR m.account_role = has_role_on_account.account_role)
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_role_on_account(uuid, varchar) TO authenticated;

CREATE OR REPLACE FUNCTION public.is_team_member(account_id uuid, user_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE public.has_role_on_account(is_team_member.account_id)
      AND m.user_id = is_team_member.user_id
      AND m.account_id = is_team_member.account_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_team_member(uuid, uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_account_team_member(target_account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = is_account_team_member.target_account_id AND m.user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_account_team_member(uuid) TO authenticated, service_role;

-- 6) RLS policies
DROP POLICY IF EXISTS accounts_read ON public.accounts;
CREATE POLICY accounts_read ON public.accounts FOR SELECT TO authenticated
USING (
  primary_owner_user_id = auth.uid()
  OR public.has_role_on_account(id)
  OR public.is_account_team_member(id)
);

DROP POLICY IF EXISTS accounts_memberships_read ON public.accounts_memberships;
CREATE POLICY accounts_memberships_read ON public.accounts_memberships FOR SELECT TO authenticated
USING (user_id = auth.uid() OR public.has_role_on_account(account_id));

DROP POLICY IF EXISTS accounts_memberships_delete ON public.accounts_memberships;
CREATE POLICY accounts_memberships_delete ON public.accounts_memberships FOR DELETE TO authenticated
USING (user_id = auth.uid());

-- 7) View the app uses to list the current user's teams
CREATE OR REPLACE VIEW public.user_accounts (id, name, picture_url, slug, role)
WITH (security_invoker = true) AS
SELECT
  account.id,
  account.name,
  account.picture_url,
  account.slug,
  membership.account_role
FROM public.accounts account
JOIN public.accounts_memberships membership ON account.id = membership.account_id
WHERE membership.user_id = auth.uid()
  AND account.is_personal_account = false;

GRANT SELECT ON public.user_accounts TO authenticated, service_role;

-- Done. You can now create teams in the app or insert manually, e.g.:
-- INSERT INTO public.accounts (name, slug, is_personal_account, primary_owner_user_id)
-- VALUES ('Oodle', 'oodle', false, 'YOUR_USER_UUID');
-- INSERT INTO public.accounts_memberships (account_id, user_id, account_role)
-- VALUES ((SELECT id FROM public.accounts WHERE slug = 'oodle'), 'YOUR_USER_UUID', 'owner');
