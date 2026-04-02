-- Repair drift: migration history marked applied but jobs/invoices (and related) never ran.
-- Idempotent: safe if objects already exist. Run via `supabase db push`.
-- Source: 20260216000005/06, 20260228120000–04.

-- ═══════════════════════════════════════════════════════════════════════════
-- Jobs V1 tables (from 20260216000005)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text,
  status text NOT NULL,
  priority text NOT NULL,
  start_date date,
  due_date date,
  estimated_minutes integer,
  actual_minutes integer,
  value_pence integer,
  cost_pence integer,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT jobs_status_check CHECK (status IN ('pending', 'in_progress', 'on_hold', 'completed', 'cancelled')),
  CONSTRAINT jobs_priority_check CHECK (priority IN ('low', 'medium', 'high', 'urgent'))
);

COMMENT ON TABLE public.jobs IS 'Jobs V1: operational core; org-scoped by account_id.';
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_status ON public.jobs(account_id, status);
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_due_date ON public.jobs(account_id, due_date);
CREATE INDEX IF NOT EXISTS ix_jobs_account_id_client_id ON public.jobs(account_id, client_id);

DROP TRIGGER IF EXISTS jobs_set_timestamps ON public.jobs;
CREATE TRIGGER jobs_set_timestamps
  BEFORE INSERT OR UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TABLE IF NOT EXISTS public.job_assignments (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_on_job text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (job_id, user_id)
);

COMMENT ON TABLE public.job_assignments IS 'Assigns users to jobs.';
CREATE INDEX IF NOT EXISTS ix_job_assignments_account_id_user_id ON public.job_assignments(account_id, user_id);
CREATE INDEX IF NOT EXISTS ix_job_assignments_account_id_job_id ON public.job_assignments(account_id, job_id);

DROP TRIGGER IF EXISTS job_assignments_set_timestamps ON public.job_assignments;
CREATE TRIGGER job_assignments_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_assignments
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TABLE IF NOT EXISTS public.job_notes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  author_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE public.job_notes IS 'Internal notes on jobs.';
CREATE INDEX IF NOT EXISTS ix_job_notes_account_id_job_id ON public.job_notes(account_id, job_id);

DROP TRIGGER IF EXISTS job_notes_set_timestamps ON public.job_notes;
CREATE TRIGGER job_notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.job_notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- ═══════════════════════════════════════════════════════════════════════════
-- Jobs RLS: enum values, role_permissions, helpers, policies (from 20260216000006)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE public._repair_add_jobs_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'jobs.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'jobs.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'jobs.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'jobs.edit';
  END IF;
  COMMIT;
END;
$$;
CALL public._repair_add_jobs_permissions_enum();
DROP PROCEDURE public._repair_add_jobs_permissions_enum();

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'jobs.view'::public.app_permissions),
  ('owner', 'jobs.edit'::public.app_permissions),
  ('admin', 'jobs.view'::public.app_permissions),
  ('admin', 'jobs.edit'::public.app_permissions),
  ('staff', 'jobs.view'::public.app_permissions),
  ('staff', 'jobs.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

CREATE OR REPLACE FUNCTION public.is_client_on_account(account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships
    WHERE accounts_memberships.account_id = is_client_on_account.account_id
      AND accounts_memberships.user_id = auth.uid()
      AND accounts_memberships.account_role = 'client'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_client_on_account(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.contractor_assigned_to_job(job_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.job_assignments
    WHERE job_assignments.job_id = contractor_assigned_to_job.job_id
      AND job_assignments.user_id = auth.uid()
  );
$$;
GRANT EXECUTE ON FUNCTION public.contractor_assigned_to_job(uuid) TO authenticated;

-- Required by jobs RLS (from 20260216000002); may be missing if that migration never ran.
CREATE OR REPLACE FUNCTION public.is_contractor_on_account(account_id uuid)
RETURNS boolean
SET search_path = ''
LANGUAGE sql
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.accounts_memberships
    WHERE accounts_memberships.account_id = is_contractor_on_account.account_id
      AND accounts_memberships.user_id = auth.uid()
      AND accounts_memberships.account_role = 'contractor'
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_contractor_on_account(uuid) TO authenticated;

ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS jobs_select ON public.jobs;
DROP POLICY IF EXISTS jobs_insert ON public.jobs;
DROP POLICY IF EXISTS jobs_update ON public.jobs;
DROP POLICY IF EXISTS jobs_delete ON public.jobs;

CREATE POLICY jobs_select ON public.jobs FOR SELECT TO authenticated
USING (
  public.has_role_on_account(account_id)
  AND NOT public.is_client_on_account(account_id)
  AND (
    NOT public.is_contractor_on_account(account_id)
    OR public.contractor_assigned_to_job(id)
  )
);

CREATE POLICY jobs_insert ON public.jobs FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

CREATE POLICY jobs_update ON public.jobs FOR UPDATE TO authenticated
USING (
  (
    public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
    AND NOT public.is_contractor_on_account(account_id)
  )
  OR (
    public.is_contractor_on_account(account_id)
    AND public.contractor_assigned_to_job(id)
  )
)
WITH CHECK (
  public.has_role_on_account(account_id)
  AND (
    (public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(account_id))
    OR (public.is_contractor_on_account(account_id) AND public.contractor_assigned_to_job(id))
  )
);

CREATE POLICY jobs_delete ON public.jobs FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.jobs TO authenticated;

ALTER TABLE public.job_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_assignments_select ON public.job_assignments;
DROP POLICY IF EXISTS job_assignments_insert ON public.job_assignments;
DROP POLICY IF EXISTS job_assignments_update ON public.job_assignments;
DROP POLICY IF EXISTS job_assignments_delete ON public.job_assignments;

CREATE POLICY job_assignments_select ON public.job_assignments FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        NOT public.is_contractor_on_account(j.account_id)
        OR public.contractor_assigned_to_job(j.id)
      )
  )
);

CREATE POLICY job_assignments_insert ON public.job_assignments FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND j.account_id = job_assignments.account_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

CREATE POLICY job_assignments_update ON public.job_assignments FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND j.account_id = job_assignments.account_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

CREATE POLICY job_assignments_delete ON public.job_assignments FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_assignments.job_id
      AND public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions)
      AND NOT public.is_contractor_on_account(j.account_id)
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_assignments TO authenticated;

ALTER TABLE public.job_notes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS job_notes_select ON public.job_notes;
DROP POLICY IF EXISTS job_notes_insert ON public.job_notes;
DROP POLICY IF EXISTS job_notes_update ON public.job_notes;
DROP POLICY IF EXISTS job_notes_delete ON public.job_notes;

CREATE POLICY job_notes_select ON public.job_notes FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_notes.job_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        NOT public.is_contractor_on_account(j.account_id)
        OR public.contractor_assigned_to_job(j.id)
      )
  )
);

CREATE POLICY job_notes_insert ON public.job_notes FOR INSERT TO authenticated
WITH CHECK (
  author_user_id = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.jobs j
    WHERE j.id = job_notes.job_id
      AND j.account_id = job_notes.account_id
      AND public.has_role_on_account(j.account_id)
      AND NOT public.is_client_on_account(j.account_id)
      AND (
        (public.has_permission(auth.uid(), j.account_id, 'jobs.edit'::public.app_permissions) AND NOT public.is_contractor_on_account(j.account_id))
        OR (public.is_contractor_on_account(j.account_id) AND public.contractor_assigned_to_job(j.id))
      )
  )
);

CREATE POLICY job_notes_update ON public.job_notes FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
)
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

CREATE POLICY job_notes_delete ON public.job_notes FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'jobs.edit'::public.app_permissions)
  AND NOT public.is_contractor_on_account(account_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.job_notes TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Invoices V1 tables (from 20260228120000)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.invoice_counters (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1
);
COMMENT ON TABLE public.invoice_counters IS 'Per-account counter for invoice numbers.';

CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  invoice_number text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  due_at timestamptz,
  subtotal_pence integer NOT NULL DEFAULT 0,
  total_pence integer NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'gbp',
  notes text,
  public_token text,
  issued_at timestamptz,
  sent_at timestamptz,
  sent_to_email text,
  paid_at timestamptz,
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT invoices_status_check CHECK (status IN ('draft', 'sent', 'paid', 'overdue', 'cancelled'))
);
COMMENT ON TABLE public.invoices IS 'Invoices V1.';
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_account_id_invoice_number ON public.invoices(account_id, invoice_number);
CREATE INDEX IF NOT EXISTS ix_invoices_account_id_status ON public.invoices(account_id, status);
CREATE INDEX IF NOT EXISTS ix_invoices_client_id ON public.invoices(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_public_token ON public.invoices(public_token) WHERE public_token IS NOT NULL;

DROP TRIGGER IF EXISTS invoices_set_timestamps ON public.invoices;
CREATE TRIGGER invoices_set_timestamps
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TABLE IF NOT EXISTS public.invoice_items (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  description text NOT NULL,
  quantity integer NOT NULL DEFAULT 1,
  unit_price_pence integer NOT NULL,
  total_pence integer NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.invoice_items IS 'Invoice line items.';
CREATE INDEX IF NOT EXISTS ix_invoice_items_account_id_invoice_id ON public.invoice_items(account_id, invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_items_invoice_id ON public.invoice_items(invoice_id);

DROP TRIGGER IF EXISTS invoice_items_set_timestamps ON public.invoice_items;
CREATE TRIGGER invoice_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

CREATE TABLE IF NOT EXISTS public.invoice_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.invoice_events IS 'Invoice audit log.';
CREATE INDEX IF NOT EXISTS ix_invoice_events_account_id_invoice_id ON public.invoice_events(account_id, invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_events_invoice_id_created_at ON public.invoice_events(invoice_id, created_at);

-- ═══════════════════════════════════════════════════════════════════════════
-- Invoices permissions + RLS (from 20260228120001 / 20260228120002)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE PROCEDURE public._repair_add_invoices_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'invoices.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'invoices.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'invoices.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'invoices.edit';
  END IF;
  COMMIT;
END;
$$;
CALL public._repair_add_invoices_permissions_enum();
DROP PROCEDURE public._repair_add_invoices_permissions_enum();

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'invoices.view'::public.app_permissions),
  ('owner', 'invoices.edit'::public.app_permissions),
  ('admin', 'invoices.view'::public.app_permissions),
  ('admin', 'invoices.edit'::public.app_permissions),
  ('staff', 'invoices.view'::public.app_permissions),
  ('staff', 'invoices.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoices_select ON public.invoices;
DROP POLICY IF EXISTS invoices_insert ON public.invoices;
DROP POLICY IF EXISTS invoices_update ON public.invoices;
DROP POLICY IF EXISTS invoices_delete ON public.invoices;

CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  AND EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = invoices.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;

ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_items_select ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_insert ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_update ON public.invoice_items;
DROP POLICY IF EXISTS invoice_items_delete ON public.invoice_items;

CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.account_id = invoice_items.account_id
  )
);

CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;

ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_events_select ON public.invoice_events;
DROP POLICY IF EXISTS invoice_events_insert ON public.invoice_events;

CREATE POLICY invoice_events_select ON public.invoice_events FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_events_insert ON public.invoice_events FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

GRANT SELECT, INSERT ON public.invoice_events TO authenticated;

ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS invoice_counters_select ON public.invoice_counters;
DROP POLICY IF EXISTS invoice_counters_update ON public.invoice_counters;
DROP POLICY IF EXISTS invoice_counters_insert ON public.invoice_counters;

CREATE POLICY invoice_counters_select ON public.invoice_counters FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_counters_update ON public.invoice_counters FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_counters_insert ON public.invoice_counters FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE ON public.invoice_counters TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- Invoice RPCs (from 20260228120003 / 20260228120004)
-- ═══════════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.allocate_invoice_number(p_account_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_next integer;
  v_formatted text;
BEGIN
  INSERT INTO public.invoice_counters (account_id, next_number)
  VALUES (p_account_id, 1)
  ON CONFLICT (account_id) DO NOTHING;

  SELECT next_number INTO v_next
  FROM public.invoice_counters
  WHERE account_id = p_account_id
  FOR UPDATE;

  v_formatted := 'INV-' || lpad(v_next::text, 4, '0');

  UPDATE public.invoice_counters
  SET next_number = next_number + 1
  WHERE account_id = p_account_id;

  RETURN v_formatted;
END;
$$;

COMMENT ON FUNCTION public.allocate_invoice_number(uuid) IS 'Allocates next invoice number for account.';
GRANT EXECUTE ON FUNCTION public.allocate_invoice_number(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.get_invoice_for_portal(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_result jsonb;
BEGIN
  IF p_token IS NULL OR p_token = '' THEN
    RETURN NULL;
  END IF;

  SELECT jsonb_build_object(
    'id', i.id,
    'account_id', i.account_id,
    'client_id', i.client_id,
    'invoice_number', i.invoice_number,
    'status', i.status,
    'due_at', i.due_at,
    'subtotal_pence', i.subtotal_pence,
    'total_pence', i.total_pence,
    'currency', i.currency,
    'notes', i.notes,
    'issued_at', i.issued_at,
    'sent_at', i.sent_at,
    'paid_at', i.paid_at,
    'created_at', i.created_at,
    'items', COALESCE(
      (SELECT jsonb_agg(
        jsonb_build_object(
          'id', it.id,
          'description', it.description,
          'quantity', it.quantity,
          'unit_price_pence', it.unit_price_pence,
          'total_pence', it.total_pence,
          'sort_order', it.sort_order
        ) ORDER BY it.sort_order
      ) FROM public.invoice_items it WHERE it.invoice_id = i.id),
      '[]'::jsonb
    ),
    'client', (
      SELECT to_jsonb(c.*) FROM public.clients c WHERE c.id = i.client_id
    )
  ) INTO v_result
  FROM public.invoices i
  WHERE i.public_token = p_token
  LIMIT 1;

  RETURN v_result;
END;
$$;

COMMENT ON FUNCTION public.get_invoice_for_portal(text) IS 'Returns one invoice by public_token for portal.';
GRANT EXECUTE ON FUNCTION public.get_invoice_for_portal(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_invoice_for_portal(text) TO authenticated;

NOTIFY pgrst, 'reload schema';
