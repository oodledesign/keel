-- AML tracking on CRM clients (commercial Contacts) and individual contact people.
-- Additive only; same row-level RLS as existing client/contact columns.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'aml_completed'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN aml_completed boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'aml_completed_at'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN aml_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'clients'
      AND column_name = 'aml_notes'
  ) THEN
    ALTER TABLE public.clients
      ADD COLUMN aml_notes text;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'aml_completed'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN aml_completed boolean NOT NULL DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'aml_completed_at'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN aml_completed_at timestamptz;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'contacts'
      AND column_name = 'aml_notes'
  ) THEN
    ALTER TABLE public.contacts
      ADD COLUMN aml_notes text;
  END IF;
END $$;

COMMENT ON COLUMN public.clients.aml_completed IS
  'Whether anti-money-laundering checks are marked complete for this client.';
COMMENT ON COLUMN public.clients.aml_completed_at IS
  'When AML was last marked complete; cleared when aml_completed is unset.';
COMMENT ON COLUMN public.clients.aml_notes IS
  'Internal notes for AML checks on this client.';

COMMENT ON COLUMN public.contacts.aml_completed IS
  'Whether anti-money-laundering checks are marked complete for this contact person.';
COMMENT ON COLUMN public.contacts.aml_completed_at IS
  'When AML was last marked complete; cleared when aml_completed is unset.';
COMMENT ON COLUMN public.contacts.aml_notes IS
  'Internal notes for AML checks on this contact person.';
