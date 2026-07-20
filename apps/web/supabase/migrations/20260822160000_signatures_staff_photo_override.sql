-- Allow Ozer to override directory-synced profile photos without losing them on sync.

ALTER TABLE signatures.staff
  ADD COLUMN IF NOT EXISTS photo_overridden boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN signatures.staff.photo_overridden IS
  'When true, Microsoft/Google directory sync must not replace photo_url.';

NOTIFY pgrst, 'reload schema';
