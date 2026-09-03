-- Contracts phase 2 workflow metadata. Additive only.
ALTER TABLE public.contracts
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_declined_at timestamptz,
  ADD COLUMN IF NOT EXISTS recipient_decline_reason text,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

COMMENT ON COLUMN public.contracts.archived_at IS 'When set, the contract is hidden from the active list; signed contracts remain retained.';
COMMENT ON COLUMN public.contracts.recipient_declined_at IS 'When the recipient declined the unsigned contract through the public portal.';
COMMENT ON COLUMN public.contracts.recipient_decline_reason IS 'Optional reason supplied by the recipient when declining.';
COMMENT ON COLUMN public.contracts.last_reminder_at IS 'When the most recent manual recipient reminder was sent.';

CREATE INDEX IF NOT EXISTS ix_contracts_account_id_archived_at
  ON public.contracts (account_id, archived_at);

NOTIFY pgrst, 'reload schema';
