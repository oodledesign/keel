import { BarChart3, ExternalLink } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import {
  WebsiteStackBadge,
  WebsiteStatusBadge,
} from '~/home/[account]/websites/_components/website-badges';
import type {
  WebsiteStack,
  WebsiteStatus,
} from '~/home/[account]/websites/_lib/schema/websites.schema';

import { PortalWebsitePlanningView } from '../../_components/portal-website-planning-view';
import { portalExternalHref } from '../_components/portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

interface PortalWebsitePageProps {
  params: Promise<{ slug: string }>;
}

export default async function PortalWebsitePage({
  params,
}: PortalWebsitePageProps) {
  const { slug } = await params;
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const website = await service.getWebsite(ctx.clientOrgId);

  const cmsUrl = website ? portalExternalHref(website.cmsAdminUrl) : null;
  const liveUrl = website ? portalExternalHref(website.domain) : null;
  const showPlanning =
    website &&
    website.portalShareScope !== 'off' &&
    (website.sitemap.length > 0 || Boolean(website.brief));

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Website
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Your website details, planning review, and quick links.
        </p>
      </div>

      {website ? (
        <Card>
          <CardHeader>
            <CardTitle>{website.name}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  Domain
                </dt>
                <dd className="mt-1 text-sm text-[var(--ozer-text-on-light)]">
                  {website.domain ?? '—'}
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  Status
                </dt>
                <dd className="mt-1">
                  <WebsiteStatusBadge
                    status={website.status as WebsiteStatus}
                  />
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium tracking-wide text-[var(--ozer-text-on-light-muted)] uppercase">
                  Stack
                </dt>
                <dd className="mt-1">
                  {website.stack ? (
                    <WebsiteStackBadge stack={website.stack as WebsiteStack} />
                  ) : (
                    '—'
                  )}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap gap-2">
              {cmsUrl ? (
                <Button asChild variant="outline">
                  <a href={cmsUrl} target="_blank" rel="noopener noreferrer">
                    Open CMS
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
              {liveUrl ? (
                <Button asChild variant="outline">
                  <a href={liveUrl} target="_blank" rel="noopener noreferrer">
                    View live site
                    <ExternalLink className="ml-1 h-4 w-4" />
                  </a>
                </Button>
              ) : null}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-12 text-center text-sm text-[var(--ozer-text-on-light-muted)]">
            No website has been linked to your account yet.
          </CardContent>
        </Card>
      )}

      {showPlanning && website ? (
        <section className="w-full space-y-4">
          <div>
            <h3 className="text-lg font-semibold text-[var(--ozer-text-on-light)]">
              Planning review
            </h3>
            <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
              {website.portalShareScope === 'sitemap'
                ? 'Read-only sitemap for your site.'
                : website.portalShareScope === 'wireframes'
                  ? 'Read-only sitemap and wireframes for your site.'
                  : 'Read-only planning review for your site.'}
            </p>
          </div>
          <PortalWebsitePlanningView
            scope={website.portalShareScope}
            sitemap={website.sitemap}
            wireframes={website.wireframes}
            style={website.style}
            brief={website.brief}
            websiteName={website.name}
          />
        </section>
      ) : null}

      <Card className="border-dashed">
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <BarChart3 className="h-5 w-5 text-[var(--workspace-shell-text-muted)]" />
          <CardTitle className="text-base">Analytics</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            Coming soon
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
