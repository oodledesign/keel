-- Work workspace: account-scoped notes and docs (Prompt 0).
-- Idempotent: safe when tables were created earlier (e.g. partial remote apply).

CREATE TABLE IF NOT EXISTS public.notes (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  is_pinned boolean NOT NULL DEFAULT false,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Backfill columns on pre-existing notes tables (drift from ad-hoc migrations)
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS content text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS property_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_job_id_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_client_id_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'properties'
  ) AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_property_id_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_property_id_fkey
      FOREIGN KEY (property_id) REFERENCES public.properties(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'notes_created_by_fkey'
  ) THEN
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_notes_account_updated ON public.notes(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_notes_account_pinned ON public.notes(account_id, is_pinned) WHERE is_pinned = true;

COMMENT ON TABLE public.notes IS 'Account notes; optional links to project (job), client, or property.';

CREATE TABLE IF NOT EXISTS public.docs (
  id uuid PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  account_id uuid NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  title text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'written',
  doc_type text,
  content text,
  storage_path text,
  job_id uuid REFERENCES public.jobs(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT docs_kind_check CHECK (kind IN ('written', 'uploaded'))
);

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS title text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'written',
  ADD COLUMN IF NOT EXISTS doc_type text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS storage_path text,
  ADD COLUMN IF NOT EXISTS job_id uuid,
  ADD COLUMN IF NOT EXISTS client_id uuid,
  ADD COLUMN IF NOT EXISTS created_by uuid,
  ADD COLUMN IF NOT EXISTS created_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docs_kind_check'
  ) THEN
    ALTER TABLE public.docs
      ADD CONSTRAINT docs_kind_check CHECK (kind IN ('written', 'uploaded'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docs_job_id_fkey'
  ) THEN
    ALTER TABLE public.docs
      ADD CONSTRAINT docs_job_id_fkey
      FOREIGN KEY (job_id) REFERENCES public.jobs(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docs_client_id_fkey'
  ) THEN
    ALTER TABLE public.docs
      ADD CONSTRAINT docs_client_id_fkey
      FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'docs_created_by_fkey'
  ) THEN
    ALTER TABLE public.docs
      ADD CONSTRAINT docs_created_by_fkey
      FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS ix_docs_account_updated ON public.docs(account_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS ix_docs_account_kind ON public.docs(account_id, kind);

COMMENT ON TABLE public.docs IS 'Account documents: written content or uploaded files (storage_path).';

DROP TRIGGER IF EXISTS notes_set_timestamps ON public.notes;
CREATE TRIGGER notes_set_timestamps
  BEFORE INSERT OR UPDATE ON public.notes
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

DROP TRIGGER IF EXISTS docs_set_timestamps ON public.docs;
CREATE TRIGGER docs_set_timestamps
  BEFORE INSERT OR UPDATE ON public.docs
  FOR EACH ROW EXECUTE FUNCTION public.trigger_set_timestamps();

ALTER TABLE public.notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.docs ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.notes TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.docs TO authenticated, service_role;

DROP POLICY IF EXISTS notes_select ON public.notes;
CREATE POLICY notes_select ON public.notes FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS notes_insert ON public.notes;
CREATE POLICY notes_insert ON public.notes FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS notes_update ON public.notes;
CREATE POLICY notes_update ON public.notes FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS notes_delete ON public.notes;
CREATE POLICY notes_delete ON public.notes FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS docs_select ON public.docs;
CREATE POLICY docs_select ON public.docs FOR SELECT TO authenticated
  USING (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS docs_insert ON public.docs;
CREATE POLICY docs_insert ON public.docs FOR INSERT TO authenticated
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS docs_update ON public.docs;
CREATE POLICY docs_update ON public.docs FOR UPDATE TO authenticated
  USING (public.has_role_on_account(account_id))
  WITH CHECK (public.has_role_on_account(account_id));

DROP POLICY IF EXISTS docs_delete ON public.docs;
CREATE POLICY docs_delete ON public.docs FOR DELETE TO authenticated
  USING (public.has_role_on_account(account_id));

NOTIFY pgrst, 'reload schema';
