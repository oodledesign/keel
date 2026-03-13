-- CRM V1: extend clients table with display_name, contact/address fields, and created_by
-- Existing column "name" becomes "display_name"; optional fields added as nullable.

-- 1) Rename name -> display_name (keeps required display name for V1); idempotent
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'name'
  ) THEN
    ALTER TABLE public.clients RENAME COLUMN name TO display_name;
  END IF;
END $$;

-- 2) Add optional contact and address columns
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS company_name text,
  ADD COLUMN IF NOT EXISTS email text,
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS address_line_1 text,
  ADD COLUMN IF NOT EXISTS address_line_2 text,
  ADD COLUMN IF NOT EXISTS city text,
  ADD COLUMN IF NOT EXISTS postcode text,
  ADD COLUMN IF NOT EXISTS country text;

-- 3) Track who created the client (nullable for existing rows)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.clients.display_name IS 'Required display name for the client (CRM V1).';
COMMENT ON COLUMN public.clients.created_by IS 'User who created this client record.';
