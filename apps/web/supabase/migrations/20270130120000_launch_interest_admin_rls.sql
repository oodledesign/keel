-- Allow super-admins to view and manage launch_interest rows in the Super Admin dashboard

drop policy if exists launch_interest_super_admin_select on public.launch_interest;
create policy launch_interest_super_admin_select on public.launch_interest
  for select to authenticated
  using (public.is_super_admin());

drop policy if exists launch_interest_super_admin_delete on public.launch_interest;
create policy launch_interest_super_admin_delete on public.launch_interest
  for delete to authenticated
  using (public.is_super_admin());

grant select, delete on public.launch_interest to authenticated;
