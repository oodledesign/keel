-- Offline / invoiced collection for client retainers and hosting.
-- Stripe-backed rows stay billing_collection = 'stripe' (default).

ALTER TABLE public.client_subscriptions
  ADD COLUMN IF NOT EXISTS billing_collection text NOT NULL DEFAULT 'stripe';

UPDATE public.client_subscriptions
SET billing_collection = 'stripe'
WHERE billing_collection IS NULL;

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
