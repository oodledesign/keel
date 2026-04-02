-- Expose accounts.space_type from team_account_workspace for client nav + route guards.

DROP FUNCTION IF EXISTS public.team_account_workspace(text);

CREATE FUNCTION public.team_account_workspace(account_slug text)
RETURNS TABLE (
  id uuid,
  name varchar(255),
  picture_url varchar(1000),
  slug text,
  role varchar(50),
  role_hierarchy_level int,
  primary_owner_user_id uuid,
  subscription_status public.subscription_status,
  permissions public.app_permissions[],
  onboarding_completed boolean,
  company_role text,
  space_type text
)
LANGUAGE plpgsql
SET search_path TO ''
AS $$
BEGIN
  RETURN QUERY
  SELECT
    accounts.id,
    accounts.name,
    accounts.picture_url,
    accounts.slug,
    accounts_memberships.account_role,
    roles.hierarchy_level,
    accounts.primary_owner_user_id,
    subscriptions.status,
    array_agg(role_permissions.permission),
    COALESCE(accounts_memberships.onboarding_completed, false),
    accounts_memberships.company_role,
    accounts.space_type
  FROM public.accounts
  JOIN public.accounts_memberships ON accounts.id = accounts_memberships.account_id
  LEFT JOIN public.subscriptions ON accounts.id = subscriptions.account_id
  JOIN public.roles ON accounts_memberships.account_role = roles.name
  LEFT JOIN public.role_permissions ON accounts_memberships.account_role = role_permissions.role
  WHERE accounts.slug = team_account_workspace.account_slug
    AND accounts_memberships.user_id = (SELECT auth.uid())
  GROUP BY
    accounts.id,
    accounts.name,
    accounts.picture_url,
    accounts.slug,
    accounts.primary_owner_user_id,
    accounts.space_type,
    accounts_memberships.account_role,
    accounts_memberships.onboarding_completed,
    accounts_memberships.company_role,
    subscriptions.status,
    roles.hierarchy_level;
END;
$$;

GRANT EXECUTE ON FUNCTION public.team_account_workspace(text) TO authenticated, service_role;

NOTIFY pgrst, 'reload schema';
