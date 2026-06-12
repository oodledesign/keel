import Link from 'next/link';
import { CreditCard, ExternalLink, Globe, LifeBuoy, Megaphone } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import { WebsiteStatusBadge } from '~/home/[account]/websites/_components/website-badges';
import type { WebsiteStatus } from '~/home/[account]/websites/_lib/schema/websites.schema';

import {
  formatPortalDate,
  formatPortalMoney,
  portalExternalHref,
} from './portal-badges';
import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import { createClientPortalService } from '../_lib/server/client-portal.service';

export default async function ClientPortalOverviewPage({
  slug,
}: {
  slug: string;
}) {
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const overview = await service.getOverview(ctx.clientOrgId);

  const supportHref = pathsConfig.app.clientPortalSupport.replace(
    '[clientSlug]',
    slug,
  );
  const websiteHref = pathsConfig.app.clientPortalWebsite.replace(
    '[clientSlug]',
    slug,
  );
  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    slug,
  );

  const cmsUrl = overview.website
    ? portalExternalHref(overview.website.cmsAdminUrl)
    : null;

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-slate-900">
          Welcome back, {ctx.displayName}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          Here&apos;s what&apos;s happening with your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Website</CardTitle>
            <Globe className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-3">
            {overview.website ? (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-slate-900">
                    {overview.website.domain ?? overview.website.name}
                  </p>
                  <WebsiteStatusBadge
                    status={overview.website.status as WebsiteStatus}
                  />
                </div>
                <div className="flex flex-wrap gap-2">
                  {cmsUrl ? (
                    <Button asChild size="sm" variant="outline">
                      <a href={cmsUrl} target="_blank" rel="noopener noreferrer">
                        Open CMS
                        <ExternalLink className="ml-1 h-3 w-3" />
                      </a>
                    </Button>
                  ) : null}
                  <Button asChild size="sm" variant="ghost">
                    <Link href={websiteHref}>View details</Link>
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-sm text-slate-500">No website linked yet.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Support</CardTitle>
            <LifeBuoy className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-slate-900">
              {overview.openTicketCount}
            </p>
            <p className="text-sm text-slate-500">
              {overview.openTicketCount === 1 ? 'open ticket' : 'open tickets'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={supportHref}>View support</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Current plan</CardTitle>
            <CreditCard className="h-4 w-4 text-slate-400" />
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.subscription ? (
              <>
                <p className="font-medium text-slate-900">
                  {overview.subscription.planName}
                </p>
                <p className="text-sm text-slate-600">
                  {formatPortalMoney(
                    overview.subscription.monthlyAmount,
                    overview.subscription.currency,
                  )}
                  /month
                </p>
                <p className="text-sm text-slate-500">
                  Next billing:{' '}
                  {formatPortalDate(overview.subscription.nextBillingDate)}
                </p>
                <Button asChild size="sm" variant="ghost">
                  <Link href={billingHref}>Billing details</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-slate-500">No active subscription.</p>
            )}
          </CardContent>
        </Card>
      </div>

      {overview.notices.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-slate-400" />
            <h3 className="text-lg font-semibold text-slate-900">Noticeboard</h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {overview.notices.map((notice) => (
              <Card key={notice.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{notice.title}</CardTitle>
                  <p className="text-xs text-slate-500">
                    {formatPortalDate(notice.createdAt)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="whitespace-pre-wrap text-sm text-slate-600">
                    {notice.content}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
