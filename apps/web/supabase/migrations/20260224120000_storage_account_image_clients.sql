-- Allow client profile photos in account_image bucket: path format account_id/client-{client_id}
-- Read: any account member can see. Write: only users with clients.edit on that account.
CREATE POLICY account_image_clients ON storage.objects
FOR ALL
USING (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'client-%'
  AND (string_to_array(name, '/'))[1]::uuid IN (
    SELECT account_id FROM public.accounts_memberships WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'client-%'
  AND (string_to_array(name, '/'))[1]::uuid IN (
    SELECT account_id FROM public.accounts_memberships
    WHERE user_id = auth.uid()
      AND public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  )
);
