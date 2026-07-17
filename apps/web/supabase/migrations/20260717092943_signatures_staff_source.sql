-- Track whether Signatures staff came from directory sync, manual entry, or CSV import.

DO $$
BEGIN
  CREATE TYPE signatures.staff_source AS ENUM (
    'microsoft',
    'google',
    'manual',
    'csv'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END
$$;

ALTER TABLE signatures.staff
  ADD COLUMN IF NOT EXISTS source signatures.staff_source;

UPDATE signatures.staff
SET
  source = CASE
    WHEN google_user_id IS NOT NULL THEN 'google'::signatures.staff_source
    WHEN ms_user_id IS NOT NULL THEN 'microsoft'::signatures.staff_source
    ELSE 'manual'::signatures.staff_source
  END
WHERE source IS NULL;

ALTER TABLE signatures.staff
  ALTER COLUMN source SET DEFAULT 'manual'::signatures.staff_source;

ALTER TABLE signatures.staff
  ALTER COLUMN source SET NOT NULL;

COMMENT ON COLUMN signatures.staff.source IS
  'Origin of the staff row: microsoft/google directory sync, manual entry, or CSV import.';

NOTIFY pgrst, 'reload schema';
