-- Expose onboarding_completed and company_role from team_account_workspace for middleware/redirect logic
-- Must drop first: PostgreSQL does not allow changing return type with CREATE OR REPLACE
drop function if exists public.team_account_workspace(text);

create function public.team_account_workspace(account_slug text)
returns table (
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
    company_role text
)
set search_path to ''
language plpgsql
as $$
begin
    return query
    select
        accounts.id,
        accounts.name,
        accounts.picture_url,
        accounts.slug,
        accounts_memberships.account_role,
        roles.hierarchy_level,
        accounts.primary_owner_user_id,
        subscriptions.status,
        array_agg(role_permissions.permission),
        coalesce(accounts_memberships.onboarding_completed, false),
        accounts_memberships.company_role
    from public.accounts
    join public.accounts_memberships on accounts.id = accounts_memberships.account_id
    left join public.subscriptions on accounts.id = subscriptions.account_id
    join public.roles on accounts_memberships.account_role = roles.name
    left join public.role_permissions on accounts_memberships.account_role = role_permissions.role
    where accounts.slug = account_slug
      and accounts_memberships.user_id = (select auth.uid())
    group by
        accounts.id,
        accounts.name,
        accounts.picture_url,
        accounts.slug,
        accounts.primary_owner_user_id,
        accounts_memberships.account_role,
        accounts_memberships.onboarding_completed,
        accounts_memberships.company_role,
        subscriptions.status,
        roles.hierarchy_level;
end;
$$;

grant execute on function public.team_account_workspace(text) to authenticated, service_role;
