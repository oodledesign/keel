-- Contact profile photos (same storage bucket pattern as clients).
ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS picture_url text;

COMMENT ON COLUMN public.contacts.picture_url IS
  'Public URL for contact avatar in account_image storage.';

NOTIFY pgrst, 'reload schema';
