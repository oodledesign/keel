-- Workspace-wide brand colours and logo URL for invoices, proposals, signatures, etc.

CREATE TABLE IF NOT EXISTS public.account_brand_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  primary_color text NOT NULL DEFAULT '#0D2344',
  secondary_color text,
  accent_color text,
  logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT account_brand_settings_primary_color_hex CHECK (
    primary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT account_brand_settings_secondary_color_hex CHECK (
    secondary_color IS NULL OR secondary_color ~ '^#[0-9A-Fa-f]{6}$'
  ),
  CONSTRAINT account_brand_settings_accent_color_hex CHECK (
    accent_color IS NULL OR accent_color ~ '^#[0-9A-Fa-f]{6}$'
  )
);

COMMENT ON TABLE public.account_brand_settings IS 'Per-workspace brand colours and logo for emails, PDFs, and HTML templates.';

DROP TRIGGER IF EXISTS account_brand_settings_set_timestamps ON public.account_brand_settings;
CREATE TRIGGER account_brand_settings_set_timestamps
  BEFORE UPDATE ON public.account_brand_settings
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.account_brand_settings ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.account_brand_settings TO authenticated, service_role;

DROP POLICY IF EXISTS account_brand_settings_select ON public.account_brand_settings;
CREATE POLICY account_brand_settings_select ON public.account_brand_settings
  FOR SELECT TO authenticated
  USING (public.has_role_on_account (account_id));

DROP POLICY IF EXISTS account_brand_settings_insert ON public.account_brand_settings;
CREATE POLICY account_brand_settings_insert ON public.account_brand_settings
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_brand_settings.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_brand_settings_update ON public.account_brand_settings;
CREATE POLICY account_brand_settings_update ON public.account_brand_settings
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_brand_settings.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_brand_settings.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS account_brand_settings_delete ON public.account_brand_settings;
CREATE POLICY account_brand_settings_delete ON public.account_brand_settings
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = account_brand_settings.account_id
        AND am.user_id = auth.uid ()
        AND am.account_role IN ('owner', 'admin')
    )
  );

NOTIFY pgrst, 'reload schema';
