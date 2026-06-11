-- Personal People profile photos in account_image bucket: {personal_account_id}/person-{person_id}

CREATE POLICY account_image_personal_people ON storage.objects
FOR ALL
TO authenticated
USING (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'person-%'
  AND EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = ((string_to_array(name, '/'))[1])::uuid
      AND a.is_personal_account = true
      AND a.primary_owner_user_id = auth.uid()
  )
)
WITH CHECK (
  bucket_id = 'account_image'
  AND (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  AND (string_to_array(name, '/'))[2] LIKE 'person-%'
  AND EXISTS (
    SELECT 1
    FROM public.accounts a
    WHERE a.id = ((string_to_array(name, '/'))[1])::uuid
      AND a.is_personal_account = true
      AND a.primary_owner_user_id = auth.uid()
  )
);
