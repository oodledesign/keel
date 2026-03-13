-- Invoices V1: invoice_counters, invoices, invoice_items, invoice_events. No RLS (add in later migration).
-- Naming follows repo: account_id (org scope), UUID PKs, ix_ indexes, trigger_set_timestamps.
-- Money in pence (integer); invoice_number unique per account via counter.

-- 1) invoice_counters (org-scoped next invoice number)
CREATE TABLE IF NOT EXISTS public.invoice_counters (
  account_id uuid PRIMARY KEY REFERENCES public.accounts(id) ON DELETE CASCADE,
  next_number integer NOT NULL DEFAULT 1
);
COMMENT ON TABLE public.invoice_counters IS 'Per-account counter for allocating invoice numbers (e.g. INV-0001). RLS later.';

-- 2) invoices
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
COMMENT ON TABLE public.invoices IS 'Invoices V1: org-scoped by account_id. Number from invoice_counters. RLS later.';
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_account_id_invoice_number ON public.invoices(account_id, invoice_number);
CREATE INDEX IF NOT EXISTS ix_invoices_account_id_status ON public.invoices(account_id, status);
CREATE INDEX IF NOT EXISTS ix_invoices_client_id ON public.invoices(client_id);
CREATE UNIQUE INDEX IF NOT EXISTS ix_invoices_public_token ON public.invoices(public_token) WHERE public_token IS NOT NULL;

DROP TRIGGER IF EXISTS invoices_set_timestamps ON public.invoices;
CREATE TRIGGER invoices_set_timestamps
  BEFORE INSERT OR UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 3) invoice_items
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
COMMENT ON TABLE public.invoice_items IS 'Line items for invoices. Totals recalculated server-side on upsert. RLS later.';
CREATE INDEX IF NOT EXISTS ix_invoice_items_account_id_invoice_id ON public.invoice_items(account_id, invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_items_invoice_id ON public.invoice_items(invoice_id);

DROP TRIGGER IF EXISTS invoice_items_set_timestamps ON public.invoice_items;
CREATE TRIGGER invoice_items_set_timestamps
  BEFORE INSERT OR UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 4) invoice_events (audit log)
CREATE TABLE IF NOT EXISTS public.invoice_events (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  payload jsonb,
  actor_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);
COMMENT ON TABLE public.invoice_events IS 'Audit log for invoice create/update/status/send. RLS later.';
CREATE INDEX IF NOT EXISTS ix_invoice_events_account_id_invoice_id ON public.invoice_events(account_id, invoice_id);
CREATE INDEX IF NOT EXISTS ix_invoice_events_invoice_id_created_at ON public.invoice_events(invoice_id, created_at);
