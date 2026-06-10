-- Notes and files: categories, public sharing, proposal context references.

-- ─── categories ───────────────────────────────────────────────────────────
ALTER TABLE public.notes
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS public_enabled_at timestamptz;

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'idea',
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS public_token text,
  ADD COLUMN IF NOT EXISTS public_enabled_at timestamptz;

ALTER TABLE public.notes DROP CONSTRAINT IF EXISTS notes_category_check;
ALTER TABLE public.notes ADD CONSTRAINT notes_category_check CHECK (
  category IN ('meeting_transcript', 'idea', 'future', 'development')
);

ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_category_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_category_check CHECK (
  category IN ('meeting_transcript', 'idea', 'future', 'development')
);

CREATE UNIQUE INDEX IF NOT EXISTS ix_notes_public_token
  ON public.notes (public_token)
  WHERE public_token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ix_docs_public_token
  ON public.docs (public_token)
  WHERE public_token IS NOT NULL;

-- ─── proposal context references ──────────────────────────────────────────
ALTER TABLE public.proposals
  ADD COLUMN IF NOT EXISTS context_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.proposals.context_refs IS
  'Linked notes/files for proposal context: [{ type: note|file, id, title }]';

NOTIFY pgrst, 'reload schema';
