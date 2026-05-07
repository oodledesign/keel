-- Some remote databases never ran the onboarding migrations that extend
-- public.app_permissions with CRM labels. Later migrations cast to
-- 'clients.edit'::app_permissions and fail with 22P02 if those labels are missing.

CREATE OR REPLACE PROCEDURE public._kel_ensure_app_permissions_clients_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.view'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.edit'
  ) THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.edit';
  END IF;
  COMMIT;
END;
$$;

CALL public._kel_ensure_app_permissions_clients_enum();
DROP PROCEDURE public._kel_ensure_app_permissions_clients_enum();
