-- Private bucket for signature staff photos (path: {account_id}/...)
-- Sync/upload uses service_role; members read via SELECT policy below.

insert into storage.buckets (id, name, public)
values ('signatures-photos', 'signatures-photos', false)
on conflict (id) do update
set
  name = excluded.name,
  public = excluded.public;

drop policy if exists signatures_photos_select_members on storage.objects;

create policy signatures_photos_select_members on storage.objects for select to authenticated using (
  bucket_id = 'signatures-photos'
  and (string_to_array(name, '/'))[1] ~ '^[0-9a-fA-F-]{36}$'
  and (string_to_array(name, '/'))[1]::uuid in (
    select account_id
    from public.accounts_memberships
    where user_id = auth.uid()
  )
);

-- service_role bypasses RLS on storage.objects; no separate policy required.
