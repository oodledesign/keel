-- Allow service_role to roll back admin_user_invites when outbound email fails.
GRANT DELETE ON public.admin_user_invites TO service_role;
