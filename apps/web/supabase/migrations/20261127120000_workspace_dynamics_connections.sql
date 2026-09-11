-- Dynamics 365 / Dataverse connection for Campaigns mailing-list sync.
-- Ozer → Dynamics contact/lead upsert. Secrets are AES-256-GCM at the app layer.

CREATE TABLE IF NOT EXISTS public.workspace_dynamics_connections (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  tenant_id text NOT NULL,
  environment_url text NOT NULL,
  application_id text NOT NULL,
  client_secret_encrypted text NOT NULL,
  sync_enabled boolean NOT NULL DEFAULT false,
  entity text NOT NULL DEFAULT 'contact'
    CHECK (entity IN ('contact', 'lead')),
  field_mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_tested_at timestamptz,
  last_test_error text,
  last_sync_at timestamptz,
  last_sync_error text,
  connected_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_dynamics_connections_account_uidx UNIQUE (account_id)
);

COMMENT ON TABLE public.workspace_dynamics_connections IS
  'Per-workspace Dataverse connection for Ozer→Dynamics mailing-list contact upsert. Client secret is application-encrypted.';

COMMENT ON COLUMN public.workspace_dynamics_connections.field_mapping IS
  'Logical-name map: email, firstName, lastName, company, companyStrategy, consentMode, consentFields, extraConsentField.';

CREATE TABLE IF NOT EXISTS public.workspace_dynamics_sync_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  preference_id uuid REFERENCES public.workspace_mailing_preferences (id)
    ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients (id) ON DELETE SET NULL,
  email text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'processing', 'succeeded', 'failed')),
  attempts integer NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  last_error text,
  next_retry_at timestamptz,
  dynamics_record_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.workspace_dynamics_sync_jobs IS
  'Retryable Ozer→Dynamics contact upserts. Public signup must not fail if Dynamics is down.';

CREATE INDEX IF NOT EXISTS workspace_dynamics_sync_jobs_due_idx
  ON public.workspace_dynamics_sync_jobs (status, next_retry_at)
  WHERE status IN ('pending', 'failed');

CREATE INDEX IF NOT EXISTS workspace_dynamics_sync_jobs_account_idx
  ON public.workspace_dynamics_sync_jobs (account_id, created_at DESC);

ALTER TABLE public.workspace_dynamics_connections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workspace_dynamics_sync_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.workspace_dynamics_connections
  FROM anon, authenticated, service_role;
REVOKE ALL ON public.workspace_dynamics_sync_jobs
  FROM anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_dynamics_connections
  TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workspace_dynamics_sync_jobs
  TO authenticated, service_role;

DROP POLICY IF EXISTS workspace_dynamics_connections_select
  ON public.workspace_dynamics_connections;
CREATE POLICY workspace_dynamics_connections_select
  ON public.workspace_dynamics_connections
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_connections_insert
  ON public.workspace_dynamics_connections;
CREATE POLICY workspace_dynamics_connections_insert
  ON public.workspace_dynamics_connections
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_connections_update
  ON public.workspace_dynamics_connections;
CREATE POLICY workspace_dynamics_connections_update
  ON public.workspace_dynamics_connections
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_connections_delete
  ON public.workspace_dynamics_connections;
CREATE POLICY workspace_dynamics_connections_delete
  ON public.workspace_dynamics_connections
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_connections_service_role
  ON public.workspace_dynamics_connections;
CREATE POLICY workspace_dynamics_connections_service_role
  ON public.workspace_dynamics_connections
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS workspace_dynamics_sync_jobs_select
  ON public.workspace_dynamics_sync_jobs;
CREATE POLICY workspace_dynamics_sync_jobs_select
  ON public.workspace_dynamics_sync_jobs
  FOR SELECT TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_sync_jobs_insert
  ON public.workspace_dynamics_sync_jobs;
CREATE POLICY workspace_dynamics_sync_jobs_insert
  ON public.workspace_dynamics_sync_jobs
  FOR INSERT TO authenticated
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_sync_jobs_update
  ON public.workspace_dynamics_sync_jobs;
CREATE POLICY workspace_dynamics_sync_jobs_update
  ON public.workspace_dynamics_sync_jobs
  FOR UPDATE TO authenticated
  USING (public.is_account_member(account_id))
  WITH CHECK (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_sync_jobs_delete
  ON public.workspace_dynamics_sync_jobs;
CREATE POLICY workspace_dynamics_sync_jobs_delete
  ON public.workspace_dynamics_sync_jobs
  FOR DELETE TO authenticated
  USING (public.is_account_member(account_id));

DROP POLICY IF EXISTS workspace_dynamics_sync_jobs_service_role
  ON public.workspace_dynamics_sync_jobs;
CREATE POLICY workspace_dynamics_sync_jobs_service_role
  ON public.workspace_dynamics_sync_jobs
  FOR ALL TO service_role
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.set_workspace_dynamics_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS workspace_dynamics_connections_set_updated_at
  ON public.workspace_dynamics_connections;
CREATE TRIGGER workspace_dynamics_connections_set_updated_at
  BEFORE UPDATE ON public.workspace_dynamics_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_dynamics_updated_at();

DROP TRIGGER IF EXISTS workspace_dynamics_sync_jobs_set_updated_at
  ON public.workspace_dynamics_sync_jobs;
CREATE TRIGGER workspace_dynamics_sync_jobs_set_updated_at
  BEFORE UPDATE ON public.workspace_dynamics_sync_jobs
  FOR EACH ROW
  EXECUTE FUNCTION public.set_workspace_dynamics_updated_at();

NOTIFY pgrst, 'reload schema';
