-- G4: Connect webhook event dedupe + optional Smart Retries tracking

CREATE TABLE IF NOT EXISTS public.connect_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  stripe_event_id text NOT NULL,
  event_type text NOT NULL,
  stripe_account_id text,
  processed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT connect_webhook_events_stripe_event_id_key UNIQUE (stripe_event_id)
);

COMMENT ON TABLE public.connect_webhook_events IS
  'Idempotency ledger for Stripe Connect webhooks (subscription / invoice lifecycle).';

CREATE INDEX IF NOT EXISTS ix_connect_webhook_events_processed_at
  ON public.connect_webhook_events (processed_at DESC);

ALTER TABLE public.connect_webhook_events ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.connect_webhook_events FROM authenticated, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.connect_webhook_events TO service_role;

-- Track that we prompted/attempted Smart Retries configuration on Connect onboarding.
ALTER TABLE public.account_payment_settings
  ADD COLUMN IF NOT EXISTS stripe_smart_retries_configured_at timestamptz;

COMMENT ON COLUMN public.account_payment_settings.stripe_smart_retries_configured_at IS
  'When Ozer last attempted/confirmed Smart Retries guidance for the connected account. Retry policy itself is Dashboard-managed on the connected account.';
