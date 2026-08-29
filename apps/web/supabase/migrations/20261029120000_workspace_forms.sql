-- Workspace form generator: account-scoped forms + submissions.
-- Public intake is token-gated via the admin client (no anon SELECT).
-- Destinations reuse pipeline_deals (generic leads) and commercial_enquiries
-- (listing-bound interest). Extra destinations can be added later without
-- rewriting the form/submission tables.

CREATE TABLE IF NOT EXISTS public.workspace_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'archived')),
  destination text NOT NULL DEFAULT 'pipeline'
    CHECK (destination IN ('pipeline', 'listing_enquiry')),
  listing_id uuid REFERENCES public.commercial_listings (id) ON DELETE SET NULL,
  share_token text NOT NULL UNIQUE,
  embed_key text NOT NULL UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  submit_label text NOT NULL DEFAULT 'Submit',
  success_message text,
  fields jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_forms_fields_is_array CHECK (jsonb_typeof(fields) = 'array')
);

CREATE INDEX IF NOT EXISTS ix_workspace_forms_account_id
  ON public.workspace_forms (account_id);

CREATE INDEX IF NOT EXISTS ix_workspace_forms_account_updated
  ON public.workspace_forms (account_id, updated_at DESC);

COMMENT ON TABLE public.workspace_forms IS
  'Workspace-owned public forms. share_token/embed_key are opaque; no anon RLS.';

COMMENT ON COLUMN public.workspace_forms.destination IS
  'Routing rule: pipeline = create pipeline_deals lead; listing_enquiry = create commercial_enquiries for a listing.';

COMMENT ON COLUMN public.workspace_forms.listing_id IS
  'Optional default listing for listing_enquiry. Embeds may override via query param or hidden field, still scoped to account_id.';

COMMENT ON COLUMN public.workspace_forms.fields IS
  'JSON array of field definitions (id, type, key, label, required, options).';

CREATE TABLE IF NOT EXISTS public.workspace_form_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  form_id uuid NOT NULL REFERENCES public.workspace_forms (id) ON DELETE CASCADE,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  contact_name text,
  contact_email text,
  contact_phone text,
  listing_id uuid REFERENCES public.commercial_listings (id) ON DELETE SET NULL,
  pipeline_deal_id uuid REFERENCES public.pipeline_deals (id) ON DELETE SET NULL,
  commercial_enquiry_id uuid REFERENCES public.commercial_enquiries (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_account_form
  ON public.workspace_form_submissions (account_id, form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_form
  ON public.workspace_form_submissions (form_id, created_at DESC);

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_deal
  ON public.workspace_form_submissions (pipeline_deal_id)
  WHERE pipeline_deal_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_workspace_form_submissions_enquiry
  ON public.workspace_form_submissions (commercial_enquiry_id)
  WHERE commercial_enquiry_id IS NOT NULL;

COMMENT ON TABLE public.workspace_form_submissions IS
  'Public form submissions plus links to the pipeline deal or listing enquiry they created.';

DROP TRIGGER IF EXISTS workspace_forms_set_timestamps ON public.workspace_forms;
CREATE TRIGGER workspace_forms_set_timestamps
  BEFORE UPDATE ON public.workspace_forms
  FOR EACH ROW
  EXECUTE PROCEDURE public.trigger_set_timestamps();

ALTER TABLE public.workspace_forms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_form_submissions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_forms FROM anon, authenticated, service_role;
REVOKE ALL ON public.workspace_form_submissions FROM anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_forms
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_form_submissions
  TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_forms_select ON public.workspace_forms;
CREATE POLICY workspace_forms_select ON public.workspace_forms
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_forms_insert ON public.workspace_forms;
CREATE POLICY workspace_forms_insert ON public.workspace_forms
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_forms_update ON public.workspace_forms;
CREATE POLICY workspace_forms_update ON public.workspace_forms
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_forms_delete ON public.workspace_forms;
CREATE POLICY workspace_forms_delete ON public.workspace_forms
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_forms_service_role ON public.workspace_forms;
CREATE POLICY workspace_forms_service_role ON public.workspace_forms
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS workspace_form_submissions_select
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_select
  ON public.workspace_form_submissions
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_form_submissions_insert
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_insert
  ON public.workspace_form_submissions
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_form_submissions_update
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_update
  ON public.workspace_form_submissions
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_form_submissions_delete
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_delete
  ON public.workspace_form_submissions
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_form_submissions_service_role
  ON public.workspace_form_submissions;
CREATE POLICY workspace_form_submissions_service_role
  ON public.workspace_form_submissions
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

-- Seed Forms for business + commercial-property workspaces.
CREATE OR REPLACE FUNCTION public.seed_account_module_settings(
  p_account_id uuid,
  p_space_type text DEFAULT 'work',
  p_business_type text DEFAULT 'other'
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  normalized_space text;
  normalized_biz text;
  keys text[];
  k text;
BEGIN
  normalized_space := lower(coalesce(p_space_type, 'work'));
  normalized_biz := lower(coalesce(p_business_type, 'other'));

  IF normalized_space = 'family' THEN
    keys := ARRAY[
      'dashboard', 'tasks', 'jobs', 'calendar', 'meal_plan', 'shopping',
      'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'community' THEN
    keys := ARRAY[
      'dashboard', 'schedule', 'tasks', 'notes', 'members', 'settings'
    ];
  ELSIF normalized_space = 'commercial-property' THEN
    keys := ARRAY[
      'dashboard', 'listings', 'pipeline', 'forms', 'clients', 'properties',
      'requirements', 'viewings', 'proposals', 'leases', 'reports', 'docs',
      'tasks', 'notes', 'sops', 'team', 'settings'
    ];
  ELSIF normalized_space = 'property' OR normalized_biz = 'property' THEN
    keys := ARRAY[
      'dashboard', 'properties', 'clients', 'jobs', 'finances',
      'docs', 'tasks', 'notes', 'team', 'settings'
    ];
  ELSIF normalized_biz = 'lite' THEN
    keys := ARRAY['dashboard', 'apps', 'settings', 'team'];
  ELSE
    keys := ARRAY[
      'dashboard', 'jobs', 'tasks', 'schedule', 'pipeline', 'forms', 'clients',
      'websites', 'support_tickets', 'client_portal', 'invoices', 'team',
      'notes', 'docs', 'sops', 'messages', 'finances', 'settings'
    ];
  END IF;

  FOREACH k IN ARRAY keys
  LOOP
    INSERT INTO public.account_module_settings (account_id, module_key, enabled)
    VALUES (p_account_id, k, true)
    ON CONFLICT (account_id, module_key) DO NOTHING;
  END LOOP;
END;
$$;

INSERT INTO public.account_module_settings (account_id, module_key, enabled)
SELECT a.id, 'forms', true
FROM public.accounts a
WHERE a.is_personal_account = false
  AND (
    a.space_type IN ('work', 'commercial-property')
    OR a.space_type IS NULL
  )
ON CONFLICT (account_id, module_key) DO NOTHING;

NOTIFY pgrst, 'reload schema';
