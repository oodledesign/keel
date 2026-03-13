-- Contractor account role and clients.view permission
-- Idempotent. Run after 20260212000005 (projects.view / projects.edit). We add clients.view/clients.edit
-- here via a procedure that COMMITs so the new enum values can be used in the same migration (PG forbids
-- using a newly added enum value in the same transaction).

-- 0) Add clients.view and clients.edit in a committed transaction so INSERTs below can use them
CREATE OR REPLACE PROCEDURE public._migration_add_clients_permissions_enum()
LANGUAGE plpgsql
AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.view';
  END IF;
  COMMIT;
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.edit';
  END IF;
  COMMIT;
END;
$$;
CALL public._migration_add_clients_permissions_enum();
DROP PROCEDURE public._migration_add_clients_permissions_enum();

-- 1) Ensure contractor role exists (hierarchy between client 10 and staff 50)
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('contractor', 30)
ON CONFLICT (name) DO UPDATE SET hierarchy_level = 30;

-- 2) Contractor permissions: assigned projects (view+edit) and read-only clients from those projects
--    RLS on projects/clients tables will scope contractor access to assigned projects only.
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('contractor', 'projects.view'::public.app_permissions),
  ('contractor', 'projects.edit'::public.app_permissions),
  ('contractor', 'clients.view'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

-- 3) clients.edit for owner, admin, staff (contractor has read-only via clients.view only)
INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'clients.edit'::public.app_permissions),
  ('admin', 'clients.edit'::public.app_permissions),
  ('staff', 'clients.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;
