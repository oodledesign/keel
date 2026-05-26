-- Storage bucket for workspace-level uploaded docs (distinct from property_documents).

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'account-documents',
  'account-documents',
  true,
  52428800,
  NULL
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS account_documents_select ON storage.objects;
CREATE POLICY account_documents_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'account-documents');

DROP POLICY IF EXISTS account_documents_insert ON storage.objects;
CREATE POLICY account_documents_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'account-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id::text
      FROM public.accounts_memberships m
      JOIN public.accounts a ON a.id = m.account_id
      WHERE m.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS account_documents_delete ON storage.objects;
CREATE POLICY account_documents_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'account-documents'
    AND (storage.foldername(name))[1] IN (
      SELECT a.id::text
      FROM public.accounts_memberships m
      JOIN public.accounts a ON a.id = m.account_id
      WHERE m.user_id = auth.uid()
    )
  );
