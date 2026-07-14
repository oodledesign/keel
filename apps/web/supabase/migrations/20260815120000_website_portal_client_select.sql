-- Prompt A4: allow authenticated client_org members to read their linked website
-- (mirrors invoices_select_client_portal / client_subscriptions_client_portal_read).
-- Sitemap/wireframes live on websites columns; app layer strips by portal_share_scope.
-- Public token access continues to use the service-role / admin client lookup.

DROP POLICY IF EXISTS websites_select_client_portal ON public.websites;
CREATE POLICY websites_select_client_portal ON public.websites
  FOR SELECT TO authenticated
  USING (
    client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = websites.client_org_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON POLICY websites_select_client_portal ON public.websites IS
  'Client portal members can read websites linked to their client_org.';

-- Briefs / style systems for portal planning when the workspace has enabled sharing.
DROP POLICY IF EXISTS website_briefs_select_client_portal ON public.website_briefs;
CREATE POLICY website_briefs_select_client_portal ON public.website_briefs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.websites w
      JOIN public.client_members cm ON cm.client_org_id = w.client_org_id
      WHERE w.id = website_briefs.website_id
        AND cm.user_id = auth.uid()
        AND w.portal_share_scope IN ('sitemap', 'wireframes', 'full')
    )
  );

DROP POLICY IF EXISTS website_style_systems_select_client_portal ON public.website_style_systems;
CREATE POLICY website_style_systems_select_client_portal ON public.website_style_systems
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.websites w
      JOIN public.client_members cm ON cm.client_org_id = w.client_org_id
      WHERE w.id = website_style_systems.website_id
        AND cm.user_id = auth.uid()
        AND w.portal_share_scope = 'full'
    )
  );

NOTIFY pgrst, 'reload schema';
