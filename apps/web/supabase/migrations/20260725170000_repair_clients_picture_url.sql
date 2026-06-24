-- Remote drift: contacts.picture_url (20260725140000) applied but clients.picture_url
-- (20260224000001) was never run on some production databases.

ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS picture_url text;

COMMENT ON COLUMN public.clients.picture_url IS
  'Public URL for client avatar in account_image storage.';

NOTIFY pgrst, 'reload schema';
