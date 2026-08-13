-- Repair: production still had the legacy 2-arg RPC that uses auth.uid().
-- App code calls add_invitations_to_account(account_slug, invitations, invited_by).
-- Earlier migrations were recorded as applied but left the old signature in place.
-- Note: invitations.company_role is not present on this database; accept_invitation
-- derives company_role from role.

drop function if exists public.add_invitations_to_account(text, public.invitation[]);

create or replace function public.add_invitations_to_account (
  account_slug text,
  invitations public.invitation[],
  invited_by uuid
) returns public.invitations[]
set search_path = ''
language plpgsql
as $$
declare
  new_invitation public.invitations;
  all_invitations public.invitations[] := array[]::public.invitations[];
  invite_token text;
  email text;
  role varchar(50);
begin
  foreach email, role in array invitations loop
    invite_token := extensions.uuid_generate_v4();

    insert into public.invitations (
      email,
      account_id,
      invited_by,
      role,
      invite_token
    )
    values (
      email,
      (
        select id
        from public.accounts
        where slug = account_slug
      ),
      invited_by,
      role,
      invite_token
    )
    returning * into new_invitation;

    all_invitations := array_append(all_invitations, new_invitation);
  end loop;

  return all_invitations;
end;
$$;

revoke execute on function public.add_invitations_to_account (text, public.invitation[], uuid) from authenticated;

grant execute on function public.add_invitations_to_account (text, public.invitation[], uuid) to service_role;
