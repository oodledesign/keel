-- Native iPhone APNs device tokens. Separate from web VAPID push_subscriptions.

CREATE TABLE IF NOT EXISTS public.native_device_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token text NOT NULL,
  platform text NOT NULL DEFAULT 'ios',
  account_id uuid REFERENCES public.accounts(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT native_device_tokens_token_key UNIQUE (token),
  CONSTRAINT native_device_tokens_platform_check CHECK (platform IN ('ios'))
);

CREATE INDEX IF NOT EXISTS ix_native_device_tokens_user_id
  ON public.native_device_tokens(user_id);

CREATE INDEX IF NOT EXISTS ix_native_device_tokens_account_id
  ON public.native_device_tokens(account_id)
  WHERE account_id IS NOT NULL;

COMMENT ON TABLE public.native_device_tokens IS
  'APNs device tokens for the Ozer iPhone app (one row per device token).';

DROP TRIGGER IF EXISTS native_device_tokens_set_timestamps ON public.native_device_tokens;
CREATE TRIGGER native_device_tokens_set_timestamps
  BEFORE INSERT OR UPDATE ON public.native_device_tokens
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.native_device_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.native_device_tokens FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.native_device_tokens TO authenticated, service_role;

DROP POLICY IF EXISTS native_device_tokens_select ON public.native_device_tokens;
CREATE POLICY native_device_tokens_select ON public.native_device_tokens
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS native_device_tokens_insert ON public.native_device_tokens;
CREATE POLICY native_device_tokens_insert ON public.native_device_tokens
  FOR INSERT TO authenticated WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS native_device_tokens_update ON public.native_device_tokens;
CREATE POLICY native_device_tokens_update ON public.native_device_tokens
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS native_device_tokens_delete ON public.native_device_tokens;
CREATE POLICY native_device_tokens_delete ON public.native_device_tokens
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

DROP POLICY IF EXISTS native_device_tokens_service ON public.native_device_tokens;
CREATE POLICY native_device_tokens_service ON public.native_device_tokens
  FOR ALL TO service_role USING (true) WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
