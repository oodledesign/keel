-- Remove invitations INSERT policy
-- Permission and role hierarchy checks are now enforced in the server action.
-- Invitations are created through server actions using admin client.

drop policy if exists invitations_create_self on public.invitations;

-- Update invitations RPC to accept invited_by and restrict execution.

drop function if exists public.add_invitations_to_account(text, public.invitation[]);

create
or replace function public.add_invitations_to_account (
  account_slug text,
  invitations public.invitation[],
  invited_by uuid
) returns public.invitations[]
set
  search_path = '' as $$
declare
    new_invitation public.invitations;
    all_invitations public.invitations[] := array[]::public.invitations[];
    invite_token text;
    email text;
    role varchar(50);
begin
    FOREACH email,
    role in array invitations loop
        invite_token := extensions.uuid_generate_v4();

        insert into public.invitations(
            email,
            account_id,
            invited_by,
            role,
            invite_token)
        values (
            email,
(
                select
                    id
                from
                    public.accounts
                where
                    slug = account_slug),
            invited_by,
            role,
            invite_token)
    returning
        * into new_invitation;

        all_invitations := array_append(all_invitations, new_invitation);

    end loop;

    return all_invitations;

end;

$$ language plpgsql;

revoke execute on function public.add_invitations_to_account (text, public.invitation[], uuid) from authenticated;

grant
execute on function public.add_invitations_to_account (text, public.invitation[], uuid) to service_role;
