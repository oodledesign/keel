-- Engagement events from ZeptoMail webhooks (opens, clicks, deliveries).

CREATE TABLE IF NOT EXISTS public.email_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  event_type TEXT NOT NULL CHECK (event_type IN ('delivered', 'open', 'click')),
  subject TEXT,
  email_reference TEXT,
  clicked_url TEXT,
  user_agent TEXT,
  raw_event JSONB,
  occurred_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_email_events_email
  ON public.email_events (lower(email));

CREATE INDEX IF NOT EXISTS idx_email_events_type
  ON public.email_events (event_type);

-- Engagement data is written by the service role from the webhook only.
ALTER TABLE public.email_events ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.email_events TO service_role;
