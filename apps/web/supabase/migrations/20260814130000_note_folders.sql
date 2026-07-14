-- Folders for notes (Apple Notes–style organisation).

CREATE TABLE IF NOT EXISTS public.note_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.accounts (id) ON DELETE CASCADE,
  name text NOT NULL,
  parent_folder_id uuid REFERENCES public.note_folders (id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT note_folders_name_check CHECK (char_length(trim(name)) BETWEEN 1 AND 120)
);

CREATE INDEX IF NOT EXISTS ix_note_folders_account_id
  ON public.note_folders (account_id);

CREATE INDEX IF NOT EXISTS ix_note_folders_parent_folder_id
  ON public.note_folders (parent_folder_id);

COMMENT ON TABLE public.note_folders IS
  'Account-scoped folders for organising notes.';

ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS folder_id uuid REFERENCES public.note_folders (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_notes_folder_id
  ON public.notes (folder_id);

CREATE INDEX IF NOT EXISTS ix_notes_account_folder_id
  ON public.notes (account_id, folder_id);

ALTER TABLE public.note_folders ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.note_folders TO authenticated, service_role;

DROP POLICY IF EXISTS note_folders_select ON public.note_folders;
CREATE POLICY note_folders_select ON public.note_folders
  FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_folders_insert ON public.note_folders;
CREATE POLICY note_folders_insert ON public.note_folders
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_folders_update ON public.note_folders;
CREATE POLICY note_folders_update ON public.note_folders
  FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS note_folders_delete ON public.note_folders;
CREATE POLICY note_folders_delete ON public.note_folders
  FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));
