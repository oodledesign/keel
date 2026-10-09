-- View-only results link for a meeting poll, shared with whoever makes the
-- final call on the time. Resolved only by service-role server routes, the
-- same way invitee tokens are.

ALTER TABLE public.meeting_polls
  ADD COLUMN IF NOT EXISTS results_token text;

ALTER TABLE public.meeting_polls
  DROP CONSTRAINT IF EXISTS meeting_polls_results_token_check;

ALTER TABLE public.meeting_polls
  ADD CONSTRAINT meeting_polls_results_token_check
  CHECK (results_token IS NULL OR results_token ~ '^[a-f0-9]{64}$');

CREATE UNIQUE INDEX IF NOT EXISTS meeting_polls_results_token_key
  ON public.meeting_polls (results_token)
  WHERE results_token IS NOT NULL;

COMMENT ON COLUMN public.meeting_polls.results_token IS
  '64-char hex secret for /poll/results/{token}: a read-only view of every answer with names. Null when the organiser has not shared or has turned the link off.';
