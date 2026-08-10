-- Pending acting agents by email (before workspace membership).
-- Auto-promoted to commercial_listing_agents when the user joins the account.

CREATE TABLE IF NOT EXISTS public.commercial_listing_pending_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  email text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_listing_pending_agents_email_nonempty
    CHECK (length(trim(email)) > 0)
);

CREATE UNIQUE INDEX IF NOT EXISTS commercial_listing_pending_agents_listing_email_uidx
  ON public.commercial_listing_pending_agents (listing_id, lower(trim(email)));

CREATE INDEX IF NOT EXISTS commercial_listing_pending_agents_account_email_idx
  ON public.commercial_listing_pending_agents (account_id, lower(trim(email)));

COMMENT ON TABLE public.commercial_listing_pending_agents IS
  'Acting-agent emails from portal feeds awaiting workspace membership; promoted on join.';

ALTER TABLE public.commercial_listing_pending_agents ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_listing_pending_agents
  TO authenticated, service_role;

DROP POLICY IF EXISTS commercial_listing_pending_agents_select
  ON public.commercial_listing_pending_agents;
CREATE POLICY commercial_listing_pending_agents_select
  ON public.commercial_listing_pending_agents
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_pending_agents_insert
  ON public.commercial_listing_pending_agents;
CREATE POLICY commercial_listing_pending_agents_insert
  ON public.commercial_listing_pending_agents
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_pending_agents_update
  ON public.commercial_listing_pending_agents;
CREATE POLICY commercial_listing_pending_agents_update
  ON public.commercial_listing_pending_agents
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_listing_pending_agents_delete
  ON public.commercial_listing_pending_agents;
CREATE POLICY commercial_listing_pending_agents_delete
  ON public.commercial_listing_pending_agents
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE OR REPLACE FUNCTION public.promote_commercial_listing_pending_agents()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  member_email text;
BEGIN
  SELECT lower(trim(u.email))
  INTO member_email
  FROM auth.users u
  WHERE u.id = NEW.user_id;

  IF member_email IS NULL OR member_email = '' THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.commercial_listing_agents (
    listing_id,
    account_id,
    user_id,
    sort_order
  )
  SELECT
    p.listing_id,
    p.account_id,
    NEW.user_id,
    p.sort_order
  FROM public.commercial_listing_pending_agents p
  WHERE p.account_id = NEW.account_id
    AND lower(trim(p.email)) = member_email
  ON CONFLICT (listing_id, user_id) DO NOTHING;

  DELETE FROM public.commercial_listing_pending_agents p
  WHERE p.account_id = NEW.account_id
    AND lower(trim(p.email)) = member_email;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_listing_pending_agents_on_membership
  ON public.accounts_memberships;
CREATE TRIGGER commercial_listing_pending_agents_on_membership
  AFTER INSERT ON public.accounts_memberships
  FOR EACH ROW
  EXECUTE FUNCTION public.promote_commercial_listing_pending_agents();

COMMENT ON FUNCTION public.promote_commercial_listing_pending_agents() IS
  'When a user joins a workspace, convert matching pending agent emails into acting agents.';
