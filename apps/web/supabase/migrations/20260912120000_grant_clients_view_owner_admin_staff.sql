-- Repair: owner/admin/staff historically had clients.edit but not clients.view.
-- Client listing (and other clients.view checks) should succeed via has_permission
-- without relying on role-name fallbacks.

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'clients.view'::public.app_permissions),
  ('admin', 'clients.view'::public.app_permissions),
  ('staff', 'clients.view'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;
