-- One-time codes for desktop recorder sign-in (web → app token exchange)

CREATE TABLE IF NOT EXISTS public.recorder_connect_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code_hash text NOT NULL UNIQUE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  state text NOT NULL,
  raw_token text NOT NULL,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ix_recorder_connect_codes_expires_at
  ON public.recorder_connect_codes (expires_at);

COMMENT ON TABLE public.recorder_connect_codes IS
  'Short-lived one-time codes used to hand a desktop recorder API token to the macOS app after web sign-in.';

ALTER TABLE public.recorder_connect_codes ENABLE ROW LEVEL SECURITY;

-- No client policies: only service role reads/writes via server code.
