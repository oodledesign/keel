-- Property workspace: optional property link on account-level docs.

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS property_id uuid REFERENCES public.properties(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS ix_docs_account_property ON public.docs(account_id, property_id)
  WHERE property_id IS NOT NULL;

COMMENT ON COLUMN public.docs.property_id IS
  'Optional link to a property (workspace-level docs; distinct from property_documents attachments).';

NOTIFY pgrst, 'reload schema';
