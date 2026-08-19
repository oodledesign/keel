-- Opt-in (and opt-out) for showing a website on the client portal.
-- Distinct from portal_share_scope, which only controls planning artefacts.

ALTER TABLE public.websites
  ADD COLUMN IF NOT EXISTS portal_visible boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.websites.portal_visible IS
  'When true, client portal members for the linked client_org can see this website (CMS, live URL, hosting notes). Planning share is still gated by portal_share_scope.';

CREATE INDEX IF NOT EXISTS ix_websites_portal_visible
  ON public.websites (client_org_id)
  WHERE portal_visible = true AND client_org_id IS NOT NULL;

-- Keep currently linked sites on the portal until someone turns them off.
UPDATE public.websites
SET portal_visible = true
WHERE client_org_id IS NOT NULL
  AND portal_visible = false;

DROP POLICY IF EXISTS websites_select_client_portal ON public.websites;
CREATE POLICY websites_select_client_portal ON public.websites
  FOR SELECT TO authenticated
  USING (
    portal_visible = true
    AND client_org_id IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM public.client_members cm
      WHERE cm.client_org_id = websites.client_org_id
        AND cm.user_id = auth.uid()
    )
  );

COMMENT ON POLICY websites_select_client_portal ON public.websites IS
  'Client portal members can read websites linked to their client_org when portal_visible is on.';

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
        AND w.portal_visible = true
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
        AND w.portal_visible = true
        AND w.portal_share_scope = 'full'
    )
  );

NOTIFY pgrst, 'reload schema';
