-- WIP activity: optional follow-up assignee on notes (chase timeline).

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS assigned_to uuid
    REFERENCES auth.users (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_notes_account_assigned_to
  ON public.notes (account_id, assigned_to)
  WHERE assigned_to IS NOT NULL;

COMMENT ON COLUMN public.notes.assigned_to IS
  'Optional teammate who should chase the next step on this WIP update.';
