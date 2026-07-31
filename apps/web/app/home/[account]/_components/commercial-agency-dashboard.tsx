'use client';

import Link from 'next/link';

import {
  Building2,
  CalendarDays,
  ClipboardList,
  Inbox,
  Plus,
  Tag,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  LISTING_STATUS_LABELS,
  type ListingStatus,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspaceIconChip,
  workspaceLinkAccent,
  workspacePanelCard,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import type {
  CommercialDashboardData,
  CommercialDashboardListing,
} from '../_lib/server/commercial-dashboard.loader';

function accountPath(accountSlug: string, template: string) {
  return template.replace('[account]', accountSlug);
}

function ActionCard({
  href,
  label,
  value,
  hint,
  icon: Icon,
  emphasize,
}: {
  href: string;
  label: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  emphasize?: boolean;
}) {
  return (
    <Link href={href} className="block">
      <Card
        className={`${workspacePanelCard} transition-colors hover:border-[var(--ozer-accent)]/35`}
      >
        <CardContent className="flex items-start gap-3 p-4">
          <div
            className={`${workspaceIconChip} ${
              emphasize && value > 0
                ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                : ''
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-2xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
              {value}
            </p>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {label}
            </p>
            <p className={`mt-0.5 text-xs ${workspaceTextMuted}`}>{hint}</p>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}

function listingLocation(listing: CommercialDashboardListing) {
  return [listing.town, listing.postcode].filter(Boolean).join(', ');
}

export function CommercialAgencyDashboard({
  accountSlug,
  metrics,
  recentListings,
}: Pick<
  CommercialDashboardData,
  'accountSlug' | 'metrics' | 'recentListings'
>) {
  const listingsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountListings,
  );
  const requirementsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountRequirements,
  );
  const viewingsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountViewings,
  );
  const pipelineHref = accountPath(
    accountSlug,
    pathsConfig.app.accountPipeline,
  );
  const reportsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountCommercialReports,
  );

  return (
    <div className="space-y-6 p-4 lg:p-6">
      <section className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Agency home
          </h2>
          <p className={`text-sm ${workspaceTextMuted}`}>
            Triage enquiries, keep stock moving, and jump into today&apos;s
            work.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild className={workspaceBtnPrimaryMd}>
            <Link href={listingsHref}>
              <Plus className="mr-1.5 h-4 w-4" />
              New disposal
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={requirementsHref}>
              <Plus className="mr-1.5 h-4 w-4" />
              New requirement
            </Link>
          </Button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <ActionCard
          href={listingsHref}
          label="Unactioned enquiries"
          value={metrics.unactionedEnquiries}
          hint={
            metrics.unactionedEnquiries > 0
              ? 'Open a disposal → Interest to triage'
              : 'Added recently'
          }
          icon={Inbox}
          emphasize
        />
        <ActionCard
          href={viewingsHref}
          label="Viewings awaiting feedback"
          value={metrics.awaitingFeedbackViewings}
          hint="Add feedback after viewings"
          icon={CalendarDays}
          emphasize
        />
        <ActionCard
          href={listingsHref}
          label="Stock on market"
          value={metrics.stockOnMarket}
          hint="Live disposals"
          icon={Building2}
        />
        <ActionCard
          href={pipelineHref}
          label="Active deals"
          value={Object.values(metrics.pipelineByStage).reduce(
            (sum, n) => sum + n,
            0,
          )}
          hint="Across the deals board"
          icon={Tag}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Card className={workspacePanelCard}>
          <CardContent className="p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
                  Recent disposals
                </h3>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Latest instructions and marketing stock
                </p>
              </div>
              <Link href={listingsHref} className={workspaceLinkAccent}>
                View all
              </Link>
            </div>

            {recentListings.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-10 text-center">
                <Building2
                  className={`mx-auto h-8 w-8 ${workspaceTextMuted}`}
                />
                <p className="mt-3 text-sm font-medium text-[var(--workspace-shell-text)]">
                  No disposals yet
                </p>
                <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
                  Add your first instruction to start marketing and tracking
                  interest.
                </p>
                <Button asChild className={`${workspaceBtnPrimaryMd} mt-4`}>
                  <Link href={listingsHref}>Create disposal</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                {recentListings.map((listing) => (
                  <li key={listing.id}>
                    <Link
                      href={accountPath(
                        accountSlug,
                        pathsConfig.app.accountListingDetail,
                      ).replace('[id]', listing.id)}
                      className="flex items-center justify-between gap-3 py-3 transition-colors hover:text-[var(--ozer-accent)]"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {listing.name}
                        </p>
                        <p className={`truncate text-xs ${workspaceTextMuted}`}>
                          {listingLocation(listing) || 'No location'} ·{' '}
                          {DISPOSAL_TYPE_LABELS[
                            listing.disposalType as DisposalType
                          ] ?? listing.disposalType}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/70">
                        {LISTING_STATUS_LABELS[
                          listing.status as ListingStatus
                        ] ?? listing.status}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardContent className="p-5">
            <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Quick links
            </h3>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Jump into the core agency modules
            </p>
            <div className="mt-4 space-y-2">
              {[
                {
                  href: requirementsHref,
                  label: 'Requirements',
                  icon: ClipboardList,
                },
                { href: pipelineHref, label: 'Deals', icon: Tag },
                { href: viewingsHref, label: 'Viewings', icon: CalendarDays },
                { href: reportsHref, label: 'Insights', icon: Building2 },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2.5 text-sm text-[var(--workspace-shell-text)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--workspace-shell-sidebar-accent)]"
                >
                  <item.icon className={`h-4 w-4 ${workspaceTextMuted}`} />
                  {item.label}
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
