-- Soft delete (archive) for clients.
-- Archived clients keep all linked data; hard delete remains available from the archive list.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS archived_at timestamptz;

COMMENT ON COLUMN public.clients.archived_at IS
  'When set, the client is archived (soft-deleted) and hidden from active lists. NULL = active.';

CREATE INDEX IF NOT EXISTS ix_clients_account_id_archived_at
  ON public.clients(account_id, archived_at)
  WHERE archived_at IS NOT NULL;
