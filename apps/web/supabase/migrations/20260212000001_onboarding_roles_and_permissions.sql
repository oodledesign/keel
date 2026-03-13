-- Onboarding: roles, permissions, get_upper_system_role
-- Idempotent. Does not drop roles. Preserves referential integrity.

-- 1) Add new permission enum values if they do not exist (for staff/client)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'projects.view') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'projects.view';
  END IF;
END$$;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid WHERE t.typname = 'app_permissions' AND e.enumlabel = 'projects.edit') THEN
    ALTER TYPE public.app_permissions ADD VALUE 'projects.edit';
  END IF;
END$$;

-- 2) Rename member -> staff if member exists and staff does not (avoid FK: insert staff with free hierarchy_level, repoint, then delete member)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.roles WHERE name = 'member')
     AND NOT EXISTS (SELECT 1 FROM public.roles WHERE name = 'staff') THEN
    -- Insert staff with target level 50 (must not conflict with unique hierarchy_level; member has 2 so use 50)
    INSERT INTO public.roles (name, hierarchy_level) VALUES ('staff', 50)
    ON CONFLICT (name) DO NOTHING;
    UPDATE public.role_permissions SET role = 'staff' WHERE role = 'member';
    UPDATE public.accounts_memberships SET account_role = 'staff' WHERE account_role = 'member';
    UPDATE public.invitations SET role = 'staff' WHERE role = 'member';
    DELETE FROM public.roles WHERE name = 'member';
  END IF;
END$$;

-- 3) Ensure target roles exist with correct hierarchy (insert missing only)
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('owner', 100), ('admin', 80), ('staff', 50), ('client', 10)
ON CONFLICT (name) DO NOTHING;

-- If owner/staff exist with old levels (1,2), update to new levels (avoid unique violation: update only if target level not taken)
UPDATE public.roles SET hierarchy_level = 100 WHERE name = 'owner' AND hierarchy_level <> 100 AND NOT EXISTS (SELECT 1 FROM public.roles r2 WHERE r2.hierarchy_level = 100 AND r2.name <> 'owner');
UPDATE public.roles SET hierarchy_level = 50 WHERE name = 'staff' AND hierarchy_level <> 50 AND NOT EXISTS (SELECT 1 FROM public.roles r2 WHERE r2.hierarchy_level = 50 AND r2.name <> 'staff');
INSERT INTO public.roles (name, hierarchy_level)
VALUES ('admin', 80), ('client', 10)
ON CONFLICT (name) DO NOTHING;

-- 4) get_upper_system_role: return role with highest hierarchy (owner = 100)
CREATE OR REPLACE FUNCTION public.get_upper_system_role()
RETURNS varchar
SET search_path = ''
LANGUAGE sql
AS $$
  SELECT name FROM public.roles ORDER BY hierarchy_level DESC NULLS LAST LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_upper_system_role() TO service_role;

-- 5) has_more_elevated_role: after hierarchy 100/80/50/10, "more elevated" = higher level number
CREATE OR REPLACE FUNCTION public.has_more_elevated_role (
  target_user_id uuid,
  target_account_id uuid,
  role_name varchar
) RETURNS boolean
SET search_path = ''
LANGUAGE plpgsql AS $$
DECLARE
  is_primary_owner boolean;
  user_role_hierarchy_level int;
  target_role_hierarchy_level int;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.accounts
    WHERE id = target_account_id AND primary_owner_user_id = target_user_id
  ) INTO is_primary_owner;
  IF is_primary_owner THEN
    RETURN true;
  END IF;
  SELECT r.hierarchy_level INTO user_role_hierarchy_level
  FROM public.roles r
  JOIN public.accounts_memberships am ON am.account_role = r.name
  WHERE am.account_id = target_account_id AND am.user_id = target_user_id;
  IF user_role_hierarchy_level IS NULL THEN
    RETURN false;
  END IF;
  SELECT hierarchy_level INTO target_role_hierarchy_level
  FROM public.roles WHERE name = role_name;
  IF target_role_hierarchy_level IS NULL THEN
    RETURN false;
  END IF;
  RETURN user_role_hierarchy_level > target_role_hierarchy_level;
END;
$$;
GRANT EXECUTE ON FUNCTION public.has_more_elevated_role (uuid, uuid, varchar) TO authenticated, service_role;

-- 6) Replace role_permissions for our four roles (original five permissions only; new enum values cannot be used in same tx - see next migration)
DELETE FROM public.role_permissions WHERE role IN ('owner', 'admin', 'staff', 'client');

-- owner: all original permissions
INSERT INTO public.role_permissions (role, permission)
VALUES ('owner', 'roles.manage'::public.app_permissions), ('owner', 'billing.manage'::public.app_permissions), ('owner', 'settings.manage'::public.app_permissions), ('owner', 'members.manage'::public.app_permissions), ('owner', 'invites.manage'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

-- admin: all except roles.manage
INSERT INTO public.role_permissions (role, permission)
VALUES ('admin', 'billing.manage'::public.app_permissions), ('admin', 'settings.manage'::public.app_permissions), ('admin', 'members.manage'::public.app_permissions), ('admin', 'invites.manage'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

-- staff: operational (original)
INSERT INTO public.role_permissions (role, permission)
VALUES ('staff', 'settings.manage'::public.app_permissions), ('staff', 'invites.manage'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

-- client: minimal (original only; projects.view added in next migration)
INSERT INTO public.role_permissions (role, permission)
VALUES ('client', 'settings.manage'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;
