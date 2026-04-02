-- App shell IA: classify shared spaces (accounts) and per-account module toggles.
-- space_type: work | family | community (NULL = personal account row).
-- account_module_settings: owner/admin can flip modules; members can read for nav.

ALTER TABLE public.accounts
  ADD COLUMN IF NOT EXISTS space_type text;

COMMENT ON COLUMN public.accounts.space_type IS 'For non-personal accounts: work, family, or community. NULL when is_personal_account.';

UPDATE public.accounts
SET space_type = 'work'
WHERE is_personal_account = false
  AND (space_type IS NULL OR btrim(space_type) = '');

ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_space_type_valid;
ALTER TABLE public.accounts ADD CONSTRAINT accounts_space_type_valid CHECK (
  is_personal_account = true
  OR space_type IN ('work', 'family', 'community')
);

CREATE TABLE IF NOT EXISTS public.account_module_settings (
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  enabled boolean NOT NULL DEFAULT true,
  PRIMARY KEY (account_id, module_key)
);

COMMENT ON TABLE public.account_module_settings IS 'Per shared-space module visibility (nav + route guards). Keys: work clients,pipeline,jobs,invoices,team,schedule; family calendar,shopping,meal_plan; community schedule,tasks,notes.';
CREATE INDEX IF NOT EXISTS ix_account_module_settings_account_id ON public.account_module_settings(account_id);

ALTER TABLE public.account_module_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_module_settings TO authenticated, service_role;

DROP POLICY IF EXISTS account_module_settings_select ON public.account_module_settings;
CREATE POLICY account_module_settings_select ON public.account_module_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS account_module_settings_insert ON public.account_module_settings;
CREATE POLICY account_module_settings_insert ON public.account_module_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_module_settings.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_module_settings_update ON public.account_module_settings;
CREATE POLICY account_module_settings_update ON public.account_module_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_module_settings.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_module_settings.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_module_settings_delete ON public.account_module_settings;
CREATE POLICY account_module_settings_delete ON public.account_module_settings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.account_id = account_module_settings.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

-- New team accounts default to work spaces.
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

  INSERT INTO public.accounts (
    name,
    slug,
    is_personal_account,
    primary_owner_user_id,
    space_type
  )
  VALUES (account_name, account_slug, false, user_id, 'work')
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
