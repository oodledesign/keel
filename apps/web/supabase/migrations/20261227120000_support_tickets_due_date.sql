-- Optional client-requested deadline on support tickets (portal service requests).

ALTER TABLE public.support_tickets
  ADD COLUMN IF NOT EXISTS due_date date;

COMMENT ON COLUMN public.support_tickets.due_date IS
  'Optional target date requested by the client when opening a portal service/support request. Date-only (no time zone).';

CREATE INDEX IF NOT EXISTS ix_support_tickets_due_date
  ON public.support_tickets (account_id, due_date)
  WHERE due_date IS NOT NULL;

NOTIFY pgrst, 'reload schema';
