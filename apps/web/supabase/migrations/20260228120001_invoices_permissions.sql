-- Invoices V1: add invoices.view and invoices.edit to app_permissions; seed Owner, Admin, Staff.
-- Contractor and Client get no invoice permissions (portal uses token-based lookup only).

CREATE OR REPLACE PROCEDURE public._migration_add_invoices_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'invoices.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'invoices.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'invoices.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'invoices.edit';
  END IF;
  COMMIT;
END;
$$;
CALL public._migration_add_invoices_permissions_enum();
DROP PROCEDURE public._migration_add_invoices_permissions_enum();

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'invoices.view'::public.app_permissions),
  ('owner', 'invoices.edit'::public.app_permissions),
  ('admin', 'invoices.view'::public.app_permissions),
  ('admin', 'invoices.edit'::public.app_permissions),
  ('staff', 'invoices.view'::public.app_permissions),
  ('staff', 'invoices.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;
