-- Per-user, per-workspace focus and availability preferences (work hours, holiday mode, OOO).

CREATE TABLE IF NOT EXISTS public.workspace_focus_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  silence_outside_hours boolean NOT NULL DEFAULT false,
  work_days integer[] NOT NULL DEFAULT '{1,2,3,4,5}',
  work_start_time time NOT NULL DEFAULT '09:00',
  work_end_time time NOT NULL DEFAULT '17:30',
  timezone text NOT NULL DEFAULT 'Europe/London',
  holiday_mode_enabled boolean NOT NULL DEFAULT false,
  holiday_mode_label text NOT NULL DEFAULT 'Holiday',
  holiday_mode_until timestamptz,
  ooo_enabled boolean NOT NULL DEFAULT false,
  ooo_trigger text NOT NULL DEFAULT 'manual',
  ooo_message text NOT NULL DEFAULT '',
  ooo_holiday_message text,
  ooo_sender_name text,
  ooo_cc_email text,
  ooo_include_return_date boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_focus_settings_account_user_key UNIQUE (account_id, user_id),
  CONSTRAINT workspace_focus_settings_ooo_trigger_check CHECK (
    ooo_trigger IN (
      'manual',
      'outside_hours',
      'holiday_only',
      'outside_hours_or_holiday',
      'outside_hours_and_holiday',
      'always'
    )
  )
);

COMMENT ON TABLE public.workspace_focus_settings IS
  'Per-user focus and availability preferences within a workspace (work hours, holiday mode, out-of-office).';

COMMENT ON COLUMN public.workspace_focus_settings.work_days IS
  '0=Sun, 1=Mon, 2=Tue, 3=Wed, 4=Thu, 5=Fri, 6=Sat';

CREATE INDEX IF NOT EXISTS idx_workspace_focus_settings_account
  ON public.workspace_focus_settings (account_id);

CREATE INDEX IF NOT EXISTS idx_workspace_focus_settings_user
  ON public.workspace_focus_settings (user_id);

-- Auto-update updated_at (create function only if missing)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.routines
    WHERE routine_schema = 'public'
      AND routine_name = 'handle_updated_at'
  ) THEN
    CREATE FUNCTION public.handle_updated_at()
    RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $fn$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $fn$;
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS workspace_focus_settings_set_updated_at
  ON public.workspace_focus_settings;

CREATE TRIGGER workspace_focus_settings_set_updated_at
  BEFORE UPDATE ON public.workspace_focus_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.workspace_focus_settings ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_focus_settings FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_focus_settings TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_focus_settings TO service_role;

DROP POLICY IF EXISTS workspace_focus_settings_self_all
  ON public.workspace_focus_settings;

CREATE POLICY workspace_focus_settings_self_all
  ON public.workspace_focus_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS workspace_focus_settings_admin_select
  ON public.workspace_focus_settings;

CREATE POLICY workspace_focus_settings_admin_select
  ON public.workspace_focus_settings
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.accounts_memberships am
      WHERE am.account_id = workspace_focus_settings.account_id
        AND am.user_id = auth.uid()
        AND am.account_role IN ('owner', 'admin')
    )
  );

NOTIFY pgrst, 'reload schema';
