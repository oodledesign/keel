-- RLS on signatures.*, feedflow.*, rankly.* calls public.is_account_member / is_account_admin.
-- Invokers must have EXECUTE on those helpers or Postgres raises:
--   permission denied for function is_account_member

grant execute on function public.is_account_member(uuid) to authenticated;
grant execute on function public.is_account_admin(uuid) to authenticated;
