-- Repair client writes: ensure role_permissions has clients.edit for operational roles,
-- and RLS INSERT/UPDATE/DELETE allow owner/admin/staff via accounts_memberships when
-- has_permission RPC drifts from role_permissions data.

INSERT INTO public.role_permissions (role, permission)
VALUES
  ('owner', 'clients.edit'::public.app_permissions),
  ('admin', 'clients.edit'::public.app_permissions),
  ('staff', 'clients.edit'::public.app_permissions)
ON CONFLICT (role, permission) DO NOTHING;

DROP POLICY IF EXISTS clients_insert ON public.clients;
CREATE POLICY clients_insert ON public.clients
FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

DROP POLICY IF EXISTS clients_update ON public.clients;
CREATE POLICY clients_update ON public.clients
FOR UPDATE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

DROP POLICY IF EXISTS clients_delete ON public.clients;
CREATE POLICY clients_delete ON public.clients
FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'clients.edit'::public.app_permissions)
  OR EXISTS (
    SELECT 1 FROM public.accounts_memberships m
    WHERE m.account_id = clients.account_id
      AND m.user_id = auth.uid()
      AND m.account_role IN ('owner', 'admin', 'staff')
  )
);

NOTIFY pgrst, 'reload schema';
