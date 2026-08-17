-- Commercial circulation: marketing preferences, embed forms, send audit log.
-- Zepto remains transactional; Amazon SES is used for circulation blasts.

-- ---------------------------------------------------------------------------
-- Marketing preference per workspace + email (purpose: matching_disposals)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_marketing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  email text NOT NULL,
  purpose text NOT NULL DEFAULT 'matching_disposals'
    CHECK (purpose IN ('matching_disposals')),
  marketing_status text NOT NULL DEFAULT 'subscribed'
    CHECK (marketing_status IN ('subscribed', 'unsubscribed', 'suppressed')),
  lawful_basis text NOT NULL DEFAULT 'website_requirement_form'
    CHECK (lawful_basis IN (
      'website_requirement_form',
      'imported_historical',
      'manual_opt_in',
      'legitimate_interests',
      'other'
    )),
  consent_source text,
  consent_copy_version text,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  suppressed_at timestamptz,
  suppression_reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_marketing_preferences_account_email_purpose_uidx
    UNIQUE (account_id, email, purpose)
);

CREATE INDEX IF NOT EXISTS commercial_marketing_preferences_account_status_idx
  ON public.commercial_marketing_preferences (account_id, marketing_status);

COMMENT ON TABLE public.commercial_marketing_preferences IS
  'Workspace-scoped marketing preference for commercial circulation (matching disposals).';

ALTER TABLE public.commercial_marketing_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_marketing_preferences FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_marketing_preferences TO authenticated;
GRANT ALL ON public.commercial_marketing_preferences TO service_role;

DROP POLICY IF EXISTS commercial_marketing_preferences_select
  ON public.commercial_marketing_preferences;
CREATE POLICY commercial_marketing_preferences_select
  ON public.commercial_marketing_preferences
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_marketing_preferences_insert
  ON public.commercial_marketing_preferences;
CREATE POLICY commercial_marketing_preferences_insert
  ON public.commercial_marketing_preferences
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_marketing_preferences_update
  ON public.commercial_marketing_preferences;
CREATE POLICY commercial_marketing_preferences_update
  ON public.commercial_marketing_preferences
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_marketing_preferences_delete
  ON public.commercial_marketing_preferences;
CREATE POLICY commercial_marketing_preferences_delete
  ON public.commercial_marketing_preferences
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE OR REPLACE FUNCTION public.set_commercial_marketing_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_marketing_preferences_set_updated_at
  ON public.commercial_marketing_preferences;
CREATE TRIGGER commercial_marketing_preferences_set_updated_at
  BEFORE UPDATE ON public.commercial_marketing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_marketing_preferences_updated_at();

-- ---------------------------------------------------------------------------
-- Public requirement form embed (one active form config per account)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_requirement_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  share_token text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  privacy_policy_url text,
  success_message text,
  consent_copy_version text NOT NULL DEFAULT 'v1',
  title text NOT NULL DEFAULT 'Register your requirement',
  intro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT commercial_requirement_forms_account_uidx UNIQUE (account_id)
);

CREATE INDEX IF NOT EXISTS commercial_requirement_forms_token_idx
  ON public.commercial_requirement_forms (share_token)
  WHERE enabled = true;

COMMENT ON TABLE public.commercial_requirement_forms IS
  'Tokenised public embed for multi-step commercial requirement intake.';

ALTER TABLE public.commercial_requirement_forms ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_requirement_forms FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_requirement_forms TO authenticated;
GRANT ALL ON public.commercial_requirement_forms TO service_role;

DROP POLICY IF EXISTS commercial_requirement_forms_select
  ON public.commercial_requirement_forms;
CREATE POLICY commercial_requirement_forms_select
  ON public.commercial_requirement_forms
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_requirement_forms_insert
  ON public.commercial_requirement_forms;
CREATE POLICY commercial_requirement_forms_insert
  ON public.commercial_requirement_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_requirement_forms_update
  ON public.commercial_requirement_forms;
CREATE POLICY commercial_requirement_forms_update
  ON public.commercial_requirement_forms
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_requirement_forms_delete
  ON public.commercial_requirement_forms;
CREATE POLICY commercial_requirement_forms_delete
  ON public.commercial_requirement_forms
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE OR REPLACE FUNCTION public.set_commercial_requirement_forms_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS commercial_requirement_forms_set_updated_at
  ON public.commercial_requirement_forms;
CREATE TRIGGER commercial_requirement_forms_set_updated_at
  BEFORE UPDATE ON public.commercial_requirement_forms
  FOR EACH ROW
  EXECUTE FUNCTION public.set_commercial_requirement_forms_updated_at();

-- ---------------------------------------------------------------------------
-- Circulation send audit
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.commercial_circulation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  listing_id uuid NOT NULL REFERENCES public.commercial_listings (id) ON DELETE CASCADE,
  sent_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  subject text NOT NULL,
  template_version text NOT NULL DEFAULT 'v1',
  recipient_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_circulation_sends_listing_idx
  ON public.commercial_circulation_sends (listing_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.commercial_circulation_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  send_id uuid NOT NULL REFERENCES public.commercial_circulation_sends (id) ON DELETE CASCADE,
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  requirement_id uuid REFERENCES public.commercial_requirements (id) ON DELETE SET NULL,
  email text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'sent', 'skipped', 'failed')),
  skip_reason text,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS commercial_circulation_recipients_send_idx
  ON public.commercial_circulation_recipients (send_id);

ALTER TABLE public.commercial_circulation_sends ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.commercial_circulation_recipients ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_circulation_sends FROM authenticated, service_role;
REVOKE ALL ON public.commercial_circulation_recipients FROM authenticated, service_role;
GRANT SELECT, INSERT ON public.commercial_circulation_sends TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.commercial_circulation_recipients TO authenticated;
GRANT ALL ON public.commercial_circulation_sends TO service_role;
GRANT ALL ON public.commercial_circulation_recipients TO service_role;

DROP POLICY IF EXISTS commercial_circulation_sends_select
  ON public.commercial_circulation_sends;
CREATE POLICY commercial_circulation_sends_select
  ON public.commercial_circulation_sends
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_sends_insert
  ON public.commercial_circulation_sends;
CREATE POLICY commercial_circulation_sends_insert
  ON public.commercial_circulation_sends
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_recipients_select
  ON public.commercial_circulation_recipients;
CREATE POLICY commercial_circulation_recipients_select
  ON public.commercial_circulation_recipients
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_recipients_insert
  ON public.commercial_circulation_recipients;
CREATE POLICY commercial_circulation_recipients_insert
  ON public.commercial_circulation_recipients
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS commercial_circulation_recipients_update
  ON public.commercial_circulation_recipients;
CREATE POLICY commercial_circulation_recipients_update
  ON public.commercial_circulation_recipients
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

-- Soft flag on requirements for website embed source tracking
ALTER TABLE public.commercial_requirements
  ADD COLUMN IF NOT EXISTS marketing_preference_id uuid
    REFERENCES public.commercial_marketing_preferences (id) ON DELETE SET NULL;
