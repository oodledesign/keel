-- Public form file uploads (unguessable paths) plus documented field logic keys.
-- File refs live in submission / draft payload JSON. Branching lives on fields JSON.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'workspace-form-uploads',
  'workspace-form-uploads',
  true,
  10485760,
  ARRAY[
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'text/plain',
    'text/csv',
    'application/rtf'
  ]
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS workspace_form_uploads_public_read ON storage.objects;
CREATE POLICY workspace_form_uploads_public_read ON storage.objects
  FOR SELECT TO public
  USING (bucket_id = 'workspace-form-uploads');

DROP POLICY IF EXISTS workspace_form_uploads_service_all ON storage.objects;
CREATE POLICY workspace_form_uploads_service_all ON storage.objects
  FOR ALL TO service_role
  USING (bucket_id = 'workspace-form-uploads')
  WITH CHECK (bucket_id = 'workspace-form-uploads');

COMMENT ON COLUMN public.workspace_forms.fields IS
  'Form field array. Known extra keys: stepBreakAfter (boolean), visibleWhen ({fieldKey,op,value}), jumpRules ([{id,op,value,targetKey}]). File answers store {name,url,path,mimeType,size} in submission/draft payload.';

NOTIFY pgrst, 'reload schema';
