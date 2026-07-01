-- Unify property_documents into the shared docs table and retire property_documents.

ALTER TABLE public.docs
  ADD COLUMN IF NOT EXISTS financial_year text,
  ADD COLUMN IF NOT EXISTS storage_bucket text NOT NULL DEFAULT 'account-documents';

CREATE INDEX IF NOT EXISTS ix_docs_financial_year ON public.docs(financial_year);
CREATE INDEX IF NOT EXISTS ix_docs_property_id ON public.docs(property_id) WHERE property_id IS NOT NULL;

COMMENT ON COLUMN public.docs.financial_year IS
  'Optional UK financial year tag, e.g. "2024/25".';
COMMENT ON COLUMN public.docs.storage_bucket IS
  'Supabase Storage bucket id for uploaded files (account-documents or legacy property-documents).';

ALTER TABLE public.docs DROP CONSTRAINT IF EXISTS docs_doc_type_check;
ALTER TABLE public.docs ADD CONSTRAINT docs_doc_type_check CHECK (
  doc_type IS NULL OR doc_type IN (
    'general', 'contract', 'lease', 'insurance', 'inspection',
    'title_deed', 'mortgage', 'tax', 'template', 'other',
    'phase_page', 'project_brief', 'utility', 'photo'
  )
);

-- Drop storage policies that reference property_documents before dropping the table.
DROP POLICY IF EXISTS "property_documents_storage_select" ON storage.objects;
DROP POLICY IF EXISTS "property_documents_storage_delete" ON storage.objects;

-- property-documents bucket RLS: account-scoped paths (no property_documents join).
CREATE POLICY "property_documents_storage_select"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'property-documents'
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.user_id = auth.uid()
        AND storage.objects.name LIKE (am.account_id::text || '/%')
    )
  );

CREATE POLICY "property_documents_storage_delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'property-documents'
    AND EXISTS (
      SELECT 1 FROM public.accounts_memberships am
      WHERE am.user_id = auth.uid()
        AND am.account_id::text = (storage.foldername(name))[1]
        AND am.account_role IN ('owner', 'admin')
    )
  );

-- Backfill legacy property uploads into docs (preserve ids and bucket paths).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'property_documents'
  ) THEN
    INSERT INTO public.docs (
      id,
      account_id,
      title,
      kind,
      doc_type,
      financial_year,
      category,
      tags,
      storage_bucket,
      file_path,
      storage_path,
      mime_type,
      file_size_bytes,
      property_id,
      created_by,
      user_id,
      created_at,
      updated_at
    )
    SELECT
      pd.id,
      pd.account_id,
      pd.name,
      'uploaded',
      pd.document_type,
      pd.financial_year,
      'idea',
      '{}',
      'property-documents',
      pd.file_path,
      pd.file_path,
      pd.mime_type,
      pd.file_size,
      pd.property_id,
      pd.uploaded_by,
      pd.uploaded_by,
      pd.created_at,
      pd.updated_at
    FROM public.property_documents pd
    WHERE NOT EXISTS (SELECT 1 FROM public.docs d WHERE d.id = pd.id);

    DROP TABLE public.property_documents CASCADE;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
