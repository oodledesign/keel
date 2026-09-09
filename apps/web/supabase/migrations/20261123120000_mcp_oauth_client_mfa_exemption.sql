-- OAuth client tokens used by remote MCP (ChatGPT / Claude) are aal1 and
-- cannot step up. Keep the MFA gate for user sessions; allow consented
-- OAuth client tokens through so tools are not silently empty.
create or replace function public.is_mfa_compliant() returns boolean
    set search_path = '' as
$$
begin
    if nullif((select auth.jwt() ->> 'client_id'), '') is not null then
        return true;
    end if;

    return array[(select auth.jwt()->>'aal')] <@ (
        select
            case
                when count(id) > 0 then array['aal2']
                else array['aal1', 'aal2']
                end as aal
        from auth.mfa_factors
        where ((select auth.uid()) = auth.mfa_factors.user_id) and auth.mfa_factors.status = 'verified'
    );
end
$$ language plpgsql security definer;

comment on function public.is_mfa_compliant() is
  'True when the session meets MFA policy, or when the JWT is an OAuth client token (client_id present).';

grant execute on function public.is_mfa_compliant() to authenticated;
