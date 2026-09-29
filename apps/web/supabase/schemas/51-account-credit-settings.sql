-- Per-workspace client credit settings. `topup_packs` overrides the default
-- portal top-up packs; null = defaults, [] = top-ups turned off.

CREATE TABLE IF NOT EXISTS public.account_credit_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  topup_packs jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_credit_settings_topup_packs_array CHECK (
    topup_packs IS NULL OR jsonb_typeof(topup_packs) = 'array'
  )
);

COMMENT ON TABLE public.account_credit_settings IS
  'Per-workspace client credit settings (portal top-up pack pricing).';
COMMENT ON COLUMN public.account_credit_settings.topup_packs IS
  'Array of { units, totalPence }. Null = default packs; empty array = top-ups off.';

DROP TRIGGER IF EXISTS account_credit_settings_set_timestamps ON public.account_credit_settings;
CREATE TRIGGER account_credit_settings_set_timestamps
BEFORE INSERT OR UPDATE ON public.account_credit_settings
FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.account_credit_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS account_credit_settings_select ON public.account_credit_settings;
CREATE POLICY account_credit_settings_select ON public.account_credit_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS account_credit_settings_insert ON public.account_credit_settings;
CREATE POLICY account_credit_settings_insert ON public.account_credit_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account (account_id, 'owner')
    OR public.has_role_on_account (account_id, 'admin')
  );

DROP POLICY IF EXISTS account_credit_settings_update ON public.account_credit_settings;
CREATE POLICY account_credit_settings_update ON public.account_credit_settings
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account (account_id, 'owner')
    OR public.has_role_on_account (account_id, 'admin')
  )
  WITH CHECK (
    public.has_role_on_account (account_id, 'owner')
    OR public.has_role_on_account (account_id, 'admin')
  );

REVOKE ALL ON public.account_credit_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.account_credit_settings TO authenticated;
GRANT ALL ON public.account_credit_settings TO service_role;
