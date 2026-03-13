-- Assign projects.view and projects.edit to roles (must run after 20260212000001 so new enum values are visible)
-- Add clients.view and clients.edit for use in 20260216000001 (new enum values cannot be used in same transaction).
-- Idempotent.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.view';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'clients.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'clients.edit';
  END IF;
END$$;

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'projects.view'::public.app_permissions),
  ('owner', 'projects.edit'::public.app_permissions),
  ('admin', 'projects.view'::public.app_permissions),
  ('admin', 'projects.edit'::public.app_permissions),
  ('staff', 'projects.view'::public.app_permissions),
  ('staff', 'projects.edit'::public.app_permissions),
  ('client', 'projects.view'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;
