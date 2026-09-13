-- Offline / invoiced collection for client retainers and hosting.
-- Additive column on public.client_subscriptions (created in billing_phase5).

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS billing_collection text NOT NULL DEFAULT 'stripe';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'client_subscriptions_billing_collection_check'
  ) THEN
    ALTER TABLE public.client_subscriptions
      ADD CONSTRAINT client_subscriptions_billing_collection_check
      CHECK (billing_collection IN ('stripe', 'offline'));
  END IF;
END $$;

COMMENT ON COLUMN public.client_subscriptions.billing_collection IS
  'stripe = collected via Stripe Checkout/Billing; offline = invoiced outside Stripe (no Stripe subscription required).';
