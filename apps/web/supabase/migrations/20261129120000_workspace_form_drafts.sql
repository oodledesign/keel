-- In-progress public form answers (resume later).
-- Drafts are not submissions: final submit still inserts workspace_form_submissions
-- and runs destinations. Public access is token-gated via the admin client.

CREATE TABLE IF NOT EXISTS public.workspace_form_drafts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.workspace_forms (id) ON DELETE CASCADE,
  resume_token text NOT NULL UNIQUE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  step_index integer NOT NULL DEFAULT 0 CHECK (step_index >= 0),
  contact_email text,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_form_drafts_payload_is_object
    CHECK (jsonb_typeof(payload) = 'object')
);

CREATE INDEX IF NOT EXISTS ix_workspace_form_drafts_form_updated
  ON public.workspace_form_drafts (form_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_form_drafts_expires_at
  ON public.workspace_form_drafts (expires_at);

COMMENT ON TABLE public.workspace_form_drafts IS
  'In-progress public form answers. resume_token is opaque; no anon RLS. Expire after ~30 days from last save (expires_at). Deleted on successful submit so a draft is never a submission.';

COMMENT ON COLUMN public.workspace_form_drafts.resume_token IS
  'Unguessable public resume token. Used as ?resume= on the form share URL.';

COMMENT ON COLUMN public.workspace_form_drafts.expires_at IS
  'Drafts are not resumable after this instant. Refreshed on each save; default TTL is 30 days. Purge with DELETE FROM workspace_form_drafts WHERE expires_at < now();';

COMMENT ON COLUMN public.workspace_forms.theme IS
  'Per-form presentation JSON. Known keys: pageBackground (light | brand_gradient), layout (standard | event), layoutExplicit (boolean), presentation (classic | steps). Steps group visible fields; stepBreakAfter on a field (default true) starts a new step after that question.';

COMMENT ON COLUMN public.workspace_forms.fields IS
  'JSON array of field definitions (id, type, key, label, required, options, helpText, placeholder, stepBreakAfter).';

DROP TRIGGER IF EXISTS workspace_form_drafts_set_timestamps
  ON public.workspace_form_drafts;
CREATE TRIGGER workspace_form_drafts_set_timestamps
  BEFORE UPDATE ON public.workspace_form_drafts
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.workspace_form_drafts ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_form_drafts FROM anon, authenticated, service_role;
GRANT SELECT ON public.workspace_form_drafts TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_form_drafts
  TO service_role;

DROP POLICY IF EXISTS workspace_form_drafts_select
  ON public.workspace_form_drafts;
CREATE POLICY workspace_form_drafts_select
  ON public.workspace_form_drafts
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_form_drafts_service_role
  ON public.workspace_form_drafts;
CREATE POLICY workspace_form_drafts_service_role
  ON public.workspace_form_drafts
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

NOTIFY pgrst, 'reload schema';
