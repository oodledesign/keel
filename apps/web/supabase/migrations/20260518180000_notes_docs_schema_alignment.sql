-- Align notes/docs with Prompt 0 schema (context links, tags, uploads).

-- ─── notes ───────────────────────────────────────────────────────────────
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_org_id uuid,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source text;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'areas'
  ) THEN
    ALTER TABLE public.notes
      ADD COLUMN IF NOT EXISTS area_id uuid REFERENCES public.areas(id) ON DELETE SET NULL;
  ELSE
    ALTER TABLE public.notes ADD COLUMN IF NOT EXISTS area_id uuid;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_orgs'
  ) THEN
    ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_client_org_id_fkey;
    ALTER TABLE public.notes
      ADD CONSTRAINT notes_client_org_id_fkey
      FOREIGN KEY (client_org_id) REFERENCES public.client_orgs(id) ON DELETE SET NULL;
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'clients'
  ) THEN
    -- Legacy: treat clients as client org for display until client_orgs is populated
    NULL;
  END IF;
END $$;

-- Backfill project_id / client_org_id from legacy columns where empty
UPDATE public.notes
SET client_org_id = client_id
WHERE client_org_id IS NULL AND client_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS ix_notes_account_project ON public.notes(account_id, project_id)
  WHERE project_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_notes_account_client_org ON public.notes(account_id, client_org_id)
  WHERE client_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS ix_notes_account_task ON public.notes(account_id, task_id)
  WHERE task_id IS NOT NULL;

-- ─── docs ────────────────────────────────────────────────────────────────
ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS client_org_id uuid,
  ADD COLUMN IF NOT EXISTS task_id uuid REFERENCES public.tasks(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS file_url text,
  ADD COLUMN IF NOT EXISTS file_path text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS is_pinned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS file_size_bytes bigint;

-- storage_path legacy alias
UPDATE public.docs SET file_path = storage_path WHERE file_path IS NULL AND storage_path IS NOT NULL;

UPDATE public.docs
SET client_org_id = client_id
WHERE client_org_id IS NULL AND client_id IS NOT NULL;

ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_doc_type_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_doc_type_check CHECK (
  doc_type IS NULL OR doc_type IN (
    'general', 'contract', 'lease', 'insurance', 'inspection',
    'title_deed', 'mortgage', 'tax', 'template', 'other'
  )
);

CREATE INDEX IF NOT EXISTS ix_docs_account_project ON public.docs(account_id, project_id)
  WHERE project_id IS NOT NULL;

NOTIFY pgrst, 'reload schema';
