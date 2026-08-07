-- Tighten UPDATE WITH CHECK on commercial_listing_co_agents to match USING.

DROP POLICY IF EXISTS commercial_listing_co_agents_update ON public.commercial_listing_co_agents;
CREATE POLICY commercial_listing_co_agents_update ON public.commercial_listing_co_agents
  FOR UPDATE TO authenticated
  USING (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  )
  WITH CHECK (
    public.has_role_on_account(account_id)
    AND (
      public.has_permission(auth.uid(), account_id, 'listings.edit'::public.app_permissions)
      OR public.has_role_on_account(account_id, 'owner')
      OR public.has_role_on_account(account_id, 'admin')
      OR public.has_role_on_account(account_id, 'staff')
    )
  );
