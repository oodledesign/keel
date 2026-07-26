-- Align support_tickets.status values with the app schema.
-- Production still had the legacy check:
--   open | in_progress | awaiting_client | resolved | closed
-- while the app writes:
--   open | in-progress | waiting | resolved | closed

UPDATE public.support_tickets
SET status = 'in-progress'
WHERE status = 'in_progress';

UPDATE public.support_tickets
SET status = 'waiting'
WHERE status = 'awaiting_client';

ALTER TABLE public.support_tickets
  DROP CONSTRAINT IF EXISTS support_tickets_status_check;

ALTER TABLE public.support_tickets
  ADD CONSTRAINT support_tickets_status_check
  CHECK (status IN ('open', 'in-progress', 'waiting', 'resolved', 'closed'));
