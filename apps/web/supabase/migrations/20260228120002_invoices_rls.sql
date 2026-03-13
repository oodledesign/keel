-- Invoices V1 RLS: Owner/Admin/Staff full access within org; DELETE only for Owner/Admin.
-- Contractor and Client: no access (portal uses server-side lookup by public_token only).

-- 1) invoices
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- SELECT: users with invoices.view or invoices.edit (Owner, Admin, Staff only; Contractor/Client have neither)
CREATE POLICY invoices_select ON public.invoices FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

-- INSERT: users with invoices.edit; WITH CHECK prevents account_id spoofing
CREATE POLICY invoices_insert ON public.invoices FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

-- UPDATE: users with invoices.edit
CREATE POLICY invoices_update ON public.invoices FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

-- DELETE: Owner or Admin only (not Staff)
CREATE POLICY invoices_delete ON public.invoices FOR DELETE TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  AND EXISTS (
    SELECT 1 FROM public.accounts_memberships am
    WHERE am.account_id = invoices.account_id
      AND am.user_id = auth.uid()
      AND am.account_role IN ('owner', 'admin')
  )
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoices TO authenticated;

-- 2) invoice_items: same org scope as invoices; only users with invoice access
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_items_select ON public.invoice_items FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_items_insert ON public.invoice_items FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
  AND EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_items.invoice_id AND i.account_id = invoice_items.account_id
  )
);

CREATE POLICY invoice_items_update ON public.invoice_items FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_items_delete ON public.invoice_items FOR DELETE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.invoice_items TO authenticated;

-- 3) invoice_events: same org scope; only users with invoice view/edit
ALTER TABLE public.invoice_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_events_select ON public.invoice_events FOR SELECT TO authenticated
USING (
  public.has_permission(auth.uid(), account_id, 'invoices.view'::public.app_permissions)
  OR public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

CREATE POLICY invoice_events_insert ON public.invoice_events FOR INSERT TO authenticated
WITH CHECK (
  public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions)
);

-- No UPDATE/DELETE on events (append-only audit)
GRANT SELECT, INSERT ON public.invoice_events TO authenticated;

-- 4) invoice_counters: SELECT/UPDATE for users with invoices.edit (used when creating invoice)
ALTER TABLE public.invoice_counters ENABLE ROW LEVEL SECURITY;

CREATE POLICY invoice_counters_select ON public.invoice_counters FOR SELECT TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

CREATE POLICY invoice_counters_update ON public.invoice_counters FOR UPDATE TO authenticated
USING (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions))
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

-- INSERT when creating first invoice for an account (same permission)
CREATE POLICY invoice_counters_insert ON public.invoice_counters FOR INSERT TO authenticated
WITH CHECK (public.has_permission(auth.uid(), account_id, 'invoices.edit'::public.app_permissions));

GRANT SELECT, INSERT, UPDATE ON public.invoice_counters TO authenticated;
