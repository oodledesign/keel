import Link from 'next/link';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';

import { WebsiteOzerSitePanel } from '~/home/[account]/websites/_components/site-studio/website-ozer-site-panel';
import { createOzerSitesService } from '~/home/[account]/websites/_lib/server/ozer-sites.service';

import { loadClientPortalContext } from '../../_lib/server/client-portal.loader';
import { createClientPortalService } from '../../_lib/server/client-portal.service';

interface PortalWebsiteEditPageProps {
  params: Promise<{ slug: string }>;
}

/**
 * F2 — mount Puck editor inside the portal shell.
 * Portal clients are auth.users + client_members (not accounts_memberships),
 * so /home/[account] Site Studio routes are not usable for them.
 */
export default async function PortalWebsiteEditPage({
  params,
}: PortalWebsiteEditPageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const portal = createClientPortalService(getSupabaseServerClient());
  const website = await portal.getWebsite(ctx.clientOrgId);

  if (!website) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Edit site</h2>
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          No website is linked to this portal yet.
        </p>
        <Button asChild variant="outline">
          <Link href={`/portal/${slug}/website`}>Back</Link>
        </Button>
      </div>
    );
  }

  const ozer = createOzerSitesService(getSupabaseServerClient());
  const bundle = await ozer.getBundleForWebsite(ctx.accountId, website.id, {
    clientOrgId: ctx.clientOrgId,
  });
  const enabled = bundle.site?.settings.portalEditEnabled === true;

  if (!enabled || !bundle.site) {
    return (
      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Edit site</h2>
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          Live site editing is not enabled for this workspace, or the site has
          not been published yet.
        </p>
        <Button asChild variant="outline">
          <Link href={`/portal/${slug}/website`}>Back</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
            Edit site
          </h2>
          <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
            Change copy and images. Structural edits may be limited by the
            agency.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href={`/portal/${slug}/website`}>Back to website</Link>
        </Button>
      </div>

      <WebsiteOzerSitePanel
        accountId={ctx.accountId}
        websiteId={website.id}
        accountSlug={slug}
        canEdit
        role="client"
        clientOrgId={ctx.clientOrgId}
      />
    </div>
  );
}
