-- Workspace form destination: mailing_list.
-- Generic subscribe/preference rows (any Forms workspace) plus optional
-- links from submissions to the contact and commercial requirement created.

ALTER TABLE public.workspace_forms
  DROP CONSTRAINT IF EXISTS workspace_forms_destination_check;

ALTER TABLE public.workspace_forms
  ADD CONSTRAINT workspace_forms_destination_check
  CHECK (destination IN ('pipeline', 'listing_enquiry', 'mailing_list'));

COMMENT ON COLUMN public.workspace_forms.destination IS
  'pipeline = pipeline_deals lead; listing_enquiry = commercial_enquiries; mailing_list = upsert clients + workspace_mailing_preferences (commercial also writes commercial_requirements + match-digest preference).';

ALTER TABLE public.workspace_form_submissions
  ADD COLUMN IF NOT EXISTS requirement_id uuid
    REFERENCES public.commercial_requirements (id) ON DELETE SET NULL;

ALTER TABLE public.workspace_form_submissions
  ADD COLUMN IF NOT EXISTS client_id uuid
    REFERENCES public.clients (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_requirement
  ON public.workspace_form_submissions (requirement_id)
  WHERE requirement_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_client
  ON public.workspace_form_submissions (client_id)
  WHERE client_id IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Generic workspace mailing list (campaign-targetable; not a second CRM)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.workspace_mailing_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  email text NOT NULL,
  purpose text NOT NULL DEFAULT 'workspace_mailing_list'
    CHECK (purpose IN ('workspace_mailing_list')),
  marketing_status text NOT NULL DEFAULT 'subscribed'
    CHECK (marketing_status IN ('subscribed', 'unsubscribed', 'suppressed')),
  lawful_basis text NOT NULL DEFAULT 'website_form'
    CHECK (lawful_basis IN (
      'website_form',
      'imported_historical',
      'manual_opt_in',
      'other'
    )),
  consent_source text,
  consent_copy_version text NOT NULL DEFAULT 'v1',
  unsubscribe_token text NOT NULL DEFAULT encode(gen_random_bytes(24), 'hex'),
  consented_at timestamptz,
  unsubscribed_at timestamptz,
  suppressed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_mailing_preferences_account_email_purpose_uidx
    UNIQUE (account_id, email, purpose)
);

CREATE UNIQUE INDEX IF NOT EXISTS workspace_mailing_preferences_unsub_token_uidx
  ON public.workspace_mailing_preferences (unsubscribe_token);

CREATE INDEX IF NOT EXISTS workspace_mailing_preferences_account_status_idx
  ON public.workspace_mailing_preferences (account_id, marketing_status);

CREATE INDEX IF NOT EXISTS workspace_mailing_preferences_account_client_idx
  ON public.workspace_mailing_preferences (account_id, client_id)
  WHERE client_id IS NOT NULL;

COMMENT ON TABLE public.workspace_mailing_preferences IS
  'Per-workspace mailing-list subscription keyed by email. People live on clients; this row is subscribe/unsubscribe state for later campaign sends.';

COMMENT ON COLUMN public.workspace_mailing_preferences.unsubscribe_token IS
  'Opaque public token for /unsubscribe/mailing-list. Never re-subscribe unsubscribed or suppressed rows from a public form.';

ALTER TABLE public.workspace_mailing_preferences ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_mailing_preferences
  FROM anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_mailing_preferences
  TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_mailing_preferences_select
  ON public.workspace_mailing_preferences;
CREATE POLICY workspace_mailing_preferences_select
  ON public.workspace_mailing_preferences
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_mailing_preferences_insert
  ON public.workspace_mailing_preferences;
CREATE POLICY workspace_mailing_preferences_insert
  ON public.workspace_mailing_preferences
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_mailing_preferences_update
  ON public.workspace_mailing_preferences;
CREATE POLICY workspace_mailing_preferences_update
  ON public.workspace_mailing_preferences
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_mailing_preferences_delete
  ON public.workspace_mailing_preferences;
CREATE POLICY workspace_mailing_preferences_delete
  ON public.workspace_mailing_preferences
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_mailing_preferences_service_role
  ON public.workspace_mailing_preferences;
CREATE POLICY workspace_mailing_preferences_service_role
  ON public.workspace_mailing_preferences
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_workspace_mailing_preferences_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_mailing_preferences_set_updated_at
  ON public.workspace_mailing_preferences;
CREATE TRIGGER workspace_mailing_preferences_set_updated_at
  BEFORE UPDATE ON public.workspace_mailing_preferences
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_mailing_preferences_updated_at();

NOTIFY pgrst, 'reload schema';
