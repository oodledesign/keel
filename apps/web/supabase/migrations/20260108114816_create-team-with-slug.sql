drop policy "create_org_account" on "public"."accounts";

drop function if exists "public"."create_team_account"(text);

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.create_team_account(account_name text, user_id uuid, account_slug text DEFAULT NULL::text)
 RETURNS public.accounts
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
    new_account public.accounts;
    owner_role varchar(50);
begin
    if (not public.is_set('enable_team_accounts')) then
        raise exception 'Team accounts are not enabled';
    end if;

    -- Get the highest system role for the owner
    select public.get_upper_system_role() into owner_role;

    -- Insert the new team account
    -- The slug will be auto-generated from name by the "set_slug_from_account_name"
    -- trigger if account_slug is null
    insert into public.accounts(
        name,
        slug,
        is_personal_account,
        primary_owner_user_id)
    values (
        account_name,
        account_slug,
        false,
        user_id)
    returning * into new_account;

    -- Create membership for the owner (atomic with account creation)
    insert into public.accounts_memberships(
        account_id,
        user_id,
        account_role)
    values (
        new_account.id,
        user_id,
        coalesce(owner_role, 'owner'));

    return new_account;

end;

$function$
;



-- Revoke from all roles first to ensure exclusivity
revoke all on function public.create_team_account(text, uuid, text) from public;
revoke all on function public.create_team_account(text, uuid, text) from authenticated;

-- Grant only to service_role
grant execute on function public.create_team_account(text, uuid, text) to service_role;

-- Drop trigger (handled by the new function)
drop trigger if exists "add_current_user_to_new_account" on "public"."accounts";
drop function if exists "kit"."add_current_user_to_new_account"();