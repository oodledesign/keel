-- Durable Rightmove bulk-publish jobs. Progress survives navigation because
-- the worker updates this row after each listing, independent of the browser.

CREATE TABLE IF NOT EXISTS public.commercial_rightmove_bulk_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'running', 'completed', 'failed', 'cancelled')),
  listing_ids uuid[] NOT NULL DEFAULT '{}',
  cursor integer NOT NULL DEFAULT 0
    CHECK (cursor >= 0),
  total integer NOT NULL DEFAULT 0
    CHECK (total >= 0),
  succeeded integer NOT NULL DEFAULT 0
    CHECK (succeeded >= 0),
  failed integer NOT NULL DEFAULT 0
    CHECK (failed >= 0),
  last_error text,
  last_listing_id uuid,
  last_listing_name text,
  failure_names text[] NOT NULL DEFAULT '{}',
  started_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  heartbeat_at timestamptz NOT NULL DEFAULT now(),
  locked_until timestamptz,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.commercial_rightmove_bulk_jobs IS
  'Account-scoped Rightmove bulk publish job. Snapshot of listing ids + cursor so work continues after the browser leaves.';

COMMENT ON COLUMN public.commercial_rightmove_bulk_jobs.listing_ids IS
  'Eligible Marketing / Under offer disposal ids at start, ordered by name.';

COMMENT ON COLUMN public.commercial_rightmove_bulk_jobs.cursor IS
  'Next index into listing_ids (0-based).';

COMMENT ON COLUMN public.commercial_rightmove_bulk_jobs.locked_until IS
  'Worker lease. Another worker may claim the job after this timestamp.';

CREATE INDEX IF NOT EXISTS commercial_rightmove_bulk_jobs_account_id_idx
  ON public.commercial_rightmove_bulk_jobs (account_id, started_at DESC);

CREATE INDEX IF NOT EXISTS commercial_rightmove_bulk_jobs_active_idx
  ON public.commercial_rightmove_bulk_jobs (status, heartbeat_at)
  WHERE status IN ('queued', 'running');

CREATE UNIQUE INDEX IF NOT EXISTS commercial_rightmove_bulk_jobs_one_active_per_account
  ON public.commercial_rightmove_bulk_jobs (account_id)
  WHERE status IN ('queued', 'running');

ALTER TABLE public.commercial_rightmove_bulk_jobs ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.commercial_rightmove_bulk_jobs FROM authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.commercial_rightmove_bulk_jobs TO authenticated;
GRANT ALL ON public.commercial_rightmove_bulk_jobs TO service_role;

CREATE POLICY commercial_rightmove_bulk_jobs_select
  ON public.commercial_rightmove_bulk_jobs
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

CREATE POLICY commercial_rightmove_bulk_jobs_insert
  ON public.commercial_rightmove_bulk_jobs
  FOR INSERT TO authenticated
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );

CREATE POLICY commercial_rightmove_bulk_jobs_update
  ON public.commercial_rightmove_bulk_jobs
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (public.has_role_on_account(account_id));

CREATE POLICY commercial_rightmove_bulk_jobs_delete
  ON public.commercial_rightmove_bulk_jobs
  FOR DELETE TO authenticated
  USING (
    public.has_role_on_account(account_id, 'owner')
    OR public.has_role_on_account(account_id, 'admin')
  );
