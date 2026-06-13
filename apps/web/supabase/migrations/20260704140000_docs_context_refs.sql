-- Store AI source references on docs (mirrors proposals.context_refs).

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS context_refs jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.docs.context_refs IS
  'Sources used for AI-generated doc content (note, file, transcript, proposal refs).';

NOTIFY pgrst, 'reload schema';
