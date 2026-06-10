-- Indy-style invoices: extended columns, payments ledger, recurring series, payment settings, portal RLS

-- 1) Extend invoices
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS read_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS reference_number text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS footer_message text,
  ADD COLUMN IF NOT EXISTS private_note text,
  ADD COLUMN IF NOT EXISTS discount_type text,
  ADD COLUMN IF NOT EXISTS discount_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_rate_bp integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS deposit_type text,
  ADD COLUMN IF NOT EXISTS deposit_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_fee_type text,
  ADD COLUMN IF NOT EXISTS late_fee_value integer DEFAULT 0,
  ADD COLUMN IF NOT EXISTS amount_paid_pence integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS recurring_series_id uuid,
  ADD COLUMN IF NOT EXISTS email_subject text,
  ADD COLUMN IF NOT EXISTS email_body text,
  ADD COLUMN IF NOT EXISTS email_signature text;

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('draft', 'sent', 'read', 'paid', 'overdue', 'cancelled', 'void'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_discount_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_discount_type_check
  CHECK (discount_type IS NULL OR discount_type IN ('percent', 'fixed'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_deposit_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_deposit_type_check
  CHECK (deposit_type IS NULL OR deposit_type IN ('percent', 'fixed'));

ALTER TABLE public.invoices DROP CONSTRAINT IF EXISTS invoices_late_fee_type_check;
ALTER TABLE public.invoices ADD CONSTRAINT invoices_late_fee_type_check
  CHECK (late_fee_type IS NULL OR late_fee_type IN ('percent', 'fixed'));

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS description_detail text;

CREATE INDEX IF NOT EXISTS ix_invoices_account_id_archived_at
  ON public.invoices (account_id, archived_at)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS ix_invoices_recurring_series_id
  ON public.invoices (recurring_series_id)
  WHERE recurring_series_id IS NOT NULL;

-- 2) invoice_payments ledger
CREATE TABLE IF NOT EXISTS public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  invoice_id uuid NOT NULL REFERENCES public.invoices (id) ON DELETE CASCADE,
  amount_pence integer NOT NULL CHECK (amount_pence > 0),
  payment_method text NOT NULL CHECK (payment_method IN ('stripe', 'bank_transfer', 'cash')),
  stripe_checkout_session_id text,
  stripe_payment_intent_id text,
  note text,
  paid_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_invoice_payments_invoice_id
  ON public.invoice_payments (invoice_id);

-- 3) invoice_recurring_series
CREATE TABLE IF NOT EXISTS public.invoice_recurring_series (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES public.clients (id) ON DELETE RESTRICT,
  title text NOT NULL DEFAULT 'Recurring invoice',
  currency text NOT NULL DEFAULT 'gbp',
  frequency text NOT NULL CHECK (frequency IN ('weekly', 'fortnightly', 'monthly', 'quarterly', 'yearly')),
  next_issue_at timestamptz NOT NULL,
  end_at timestamptz,
  max_occurrences integer,
  occurrences_issued integer NOT NULL DEFAULT 0,
  auto_send boolean NOT NULL DEFAULT true,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paused', 'ended')),
  template jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_invoice_recurring_series_account_id_status
  ON public.invoice_recurring_series (account_id, status);

CREATE INDEX IF NOT EXISTS ix_invoice_recurring_series_next_issue
  ON public.invoice_recurring_series (next_issue_at)
  WHERE status = 'active';

DROP TRIGGER IF EXISTS invoice_recurring_series_set_timestamps ON public.invoice_recurring_series;
CREATE TRIGGER invoice_recurring_series_set_timestamps
  BEFORE INSERT OR UPDATE ON public.invoice_recurring_series
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_recurring_series_id_fkey;

ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_recurring_series_id_fkey
  FOREIGN KEY (recurring_series_id)
  REFERENCES public.invoice_recurring_series (id)
  ON DELETE SET NULL;

-- 4) account_payment_settings
CREATE TABLE IF NOT EXISTS public.account_payment_settings (
  account_id uuid PRIMARY KEY REFERENCES public.accounts (id) ON DELETE CASCADE,
  bank_account_name text,
  bank_sort_code text,
  bank_account_number text,
  bank_iban text,
  bank_bic text,
  bank_transfer_enabled boolean NOT NULL DEFAULT false,
  bank_transfer_instructions text,
  stripe_account_id text,
  stripe_connect_enabled boolean NOT NULL DEFAULT false,
  stripe_pay_now_enabled boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DROP TRIGGER IF EXISTS account_payment_settings_set_timestamps ON public.account_payment_settings;
CREATE TRIGGER account_payment_settings_set_timestamps
  BEFORE INSERT OR UPDATE ON public.account_payment_settings
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

-- 5) RLS for new tables
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_recurring_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_payment_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_payments_select ON public.invoice_payments FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_payments_insert ON public.invoice_payments FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

GRANT SELECT, INSERT ON public.invoice_payments TO authenticated;

CREATE POLICY invoice_recurring_series_select ON public.invoice_recurring_series FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_recurring_series_insert ON public.invoice_recurring_series FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_recurring_series_update ON public.invoice_recurring_series FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_recurring_series_delete ON public.invoice_recurring_series FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  AND EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = invoice_recurring_series.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_recurring_series TO authenticated;

CREATE POLICY account_payment_settings_select ON public.account_payment_settings FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  OR public.has_role_on_account(account_id)
);

CREATE POLICY account_payment_settings_insert ON public.account_payment_settings FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = account_payment_settings.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

CREATE POLICY account_payment_settings_update ON public.account_payment_settings FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = account_payment_settings.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = account_payment_settings.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

GRANT SELECT, INSERT, UPDATE ON public.account_payment_settings TO authenticated;

-- 6) Client portal: allow client_members to read invoices for their org
CREATE POLICY invoices_select_client_portal ON public.invoices FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.clients c
    JOIN public.client_orgs co ON co.id = c.client_org_id
    JOIN public.client_members cm ON cm.client_org_id = co.id
    WHERE c.id = invoices.client_id
      AND cm.user_id = auth.uid()
  )
);

CREATE POLICY invoice_items_select_client_portal ON public.invoice_items FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.invoices i
    JOIN public.clients c ON c.id = i.client_id
    JOIN public.client_orgs co ON co.id = c.client_org_id
    JOIN public.client_members cm ON cm.client_org_id = co.id
    WHERE i.id = invoice_items.invoice_id
      AND cm.user_id = auth.uid()
  )
);
