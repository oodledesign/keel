-- Repair: core Makerkit role_permissions (invites/members/settings/billing/roles)
-- were missing in production, which hid Invite Members and blocked invitation RPCs.
-- Idempotent — only inserts missing rows for roles that exist.

INSERT INTO public.role_permissions (role, permission)
SELECT v.role, v.permission
FROM (
  VALUES
    -- owner
    ('owner', 'roles.manage'::public.app_permissions),
    ('owner', 'billing.manage'::public.app_permissions),
    ('owner', 'settings.manage'::public.app_permissions),
    ('owner', 'members.manage'::public.app_permissions),
    ('owner', 'invites.manage'::public.app_permissions),
    -- admin
    ('admin', 'billing.manage'::public.app_permissions),
    ('admin', 'settings.manage'::public.app_permissions),
    ('admin', 'members.manage'::public.app_permissions),
    ('admin', 'invites.manage'::public.app_permissions),
    -- staff
    ('staff', 'settings.manage'::public.app_permissions),
    ('staff', 'invites.manage'::public.app_permissions),
    -- client (only if role row exists)
    ('client', 'settings.manage'::public.app_permissions)
) AS v(role, permission)
INNER JOIN public.roles r ON r.name = v.role
ON CONFLICT (role, permission) DO NOTHING;
