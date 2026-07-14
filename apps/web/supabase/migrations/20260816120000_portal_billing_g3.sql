-- G3: cache Stripe subscription invoices for portal billing (avoid Stripe on every render).

CREATE TABLE IF NOT EXISTS public.portal_billing_invoice_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  stripe_account_id text NOT NULL,
  stripe_customer_id text NOT NULL,
  invoices jsonb NOT NULL DEFAULT '[]'::jsonb,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portal_billing_invoice_cache_customer_unique
    UNIQUE (stripe_account_id, stripe_customer_id)
);

COMMENT ON TABLE public.portal_billing_invoice_cache IS
  'G3: Cached Stripe Invoice list for a Connect customer (portal Billing payment history).';

CREATE INDEX IF NOT EXISTS ix_portal_billing_invoice_cache_account_id
  ON public.portal_billing_invoice_cache (account_id);

DROP TRIGGER IF EXISTS portal_billing_invoice_cache_set_timestamps
  ON public.portal_billing_invoice_cache;
CREATE TRIGGER portal_billing_invoice_cache_set_timestamps
  BEFORE INSERT OR UPDATE ON public.portal_billing_invoice_cache
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.portal_billing_invoice_cache ENABLE ROW LEVEL SECURITY;

-- Workspace can read; writes go through service role / admin in app code.
DROP POLICY IF EXISTS portal_billing_invoice_cache_select ON public.portal_billing_invoice_cache;
CREATE POLICY portal_billing_invoice_cache_select ON public.portal_billing_invoice_cache
  FOR SELECT TO authenticated
  USING (
    public.has_role_on_account (account_id)
    OR EXISTS (
      SELECT 1
      FROM public.clients c
      JOIN public.client_members cm ON cm.client_org_id = c.client_org_id
      WHERE c.account_id = portal_billing_invoice_cache.account_id
        AND c.stripe_customer_id_connect = portal_billing_invoice_cache.stripe_customer_id
        AND cm.user_id = (SELECT auth.uid ())
    )
  );

GRANT SELECT ON public.portal_billing_invoice_cache TO authenticated;
GRANT ALL ON public.portal_billing_invoice_cache TO service_role;

ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS stripe_billing_portal_configuration_id text;

COMMENT ON COLUMN public.account_payment_settings.stripe_billing_portal_configuration_id IS
  'G3: Stripe Billing Portal Configuration id on the connected account (payment method + invoices only).';
