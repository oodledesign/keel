-- Workspace docs do not need a public bucket: in-app and portal shares
-- already use createSignedUrl. Close anonymous reads and scope member RLS.

update storage.buckets
set public = false
where id = 'account-documents';

drop policy if exists account_documents_select on storage.objects;
create policy account_documents_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists account_documents_insert on storage.objects;
create policy account_documents_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists account_documents_delete on storage.objects;
create policy account_documents_delete on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'account-documents'
    and (storage.foldername(name))[1] ~ '^[0-9a-fA-F-]{36}$'
    and public.has_role_on_account(((storage.foldername(name))[1])::uuid)
  );
