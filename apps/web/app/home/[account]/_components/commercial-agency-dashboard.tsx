'use client';

import Link from 'next/link';

import {
  Building2,
  CalendarDays,
  ClipboardList,
  Inbox,
  Sparkles,
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
  shortLabel,
  value,
  hint,
  icon: Icon,
  emphasize,
}: {
  href: string;
  label: string;
  shortLabel?: string;
  value: number;
  hint: string;
  icon: React.ComponentType<{ className?: string }>;
  emphasize?: boolean;
}) {
  return (
    <Link href={href} className="block min-w-0">
      <Card
        className={`${workspacePanelCard} h-full transition-colors hover:border-[var(--ozer-accent)]/35`}
      >
        <CardContent className="flex flex-col gap-2 p-3 sm:flex-row sm:items-start sm:gap-3 sm:p-4">
          <div
            className={`${workspaceIconChip} hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${
              emphasize && value > 0
                ? 'bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]'
                : ''
            }`}
          >
            <Icon className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-xl font-semibold text-[var(--workspace-shell-text)] tabular-nums sm:text-2xl">
              {value}
            </p>
            <p className="mt-0.5 text-[11px] leading-snug font-medium text-[var(--workspace-shell-text)] sm:text-sm">
              {shortLabel ? (
                <>
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}</span>
                </>
              ) : (
                label
              )}
            </p>
            <p
              className={`mt-0.5 hidden text-xs sm:block ${workspaceTextMuted}`}
            >
              {hint}
            </p>
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
  matchDigest,
}: Pick<
  CommercialDashboardData,
  'accountSlug' | 'metrics' | 'recentListings' | 'matchDigest'
>) {
  const listingsHref = accountPath(
    accountSlug,
    pathsConfig.app.accountListings,
  );
  const requirementsHref = `${accountPath(
    accountSlug,
    pathsConfig.app.accountPipeline,
  )}?view=requirements`;
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
    <div className="min-w-0 space-y-6 p-4 pb-[calc(5.5rem+max(1.5rem,env(safe-area-inset-bottom)))] lg:p-6 lg:pb-6">
      <section className="grid grid-cols-3 gap-2 sm:gap-3 xl:grid-cols-5">
        <ActionCard
          href={listingsHref}
          label="Unactioned enquiries"
          shortLabel="Unactioned"
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
          shortLabel="Awaiting feedback"
          value={metrics.awaitingFeedbackViewings}
          hint="Add feedback after viewings"
          icon={CalendarDays}
          emphasize
        />
        <ActionCard
          href={listingsHref}
          label="Stock on market"
          shortLabel="On market"
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
        <ActionCard
          href={`${listingsHref}`}
          label="Match opportunities"
          shortLabel="Matches"
          value={matchDigest.count}
          hint={
            matchDigest.count > 0
              ? 'New requirement ↔ stock fits'
              : 'No strong fits right now'
          }
          icon={Sparkles}
          emphasize
        />
      </section>

      {matchDigest.suggestions.length > 0 ? (
        <section>
          <Card className={`${workspacePanelCard} min-w-0 overflow-hidden`}>
            <CardContent className="p-4 sm:p-5">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
                    Desk digest — suggested fits
                  </h3>
                  <p className={`text-sm ${workspaceTextMuted}`}>
                    Recent requirements scored against live stock
                  </p>
                </div>
              </div>
              <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
                {matchDigest.suggestions.map((item) => (
                  <li
                    key={`${item.listingId}:${item.requirementId}`}
                    className="flex min-w-0 flex-wrap items-center justify-between gap-2 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {item.requirementLabel}
                        <span className={`font-normal ${workspaceTextMuted}`}>
                          {' '}
                          → {item.listingName}
                        </span>
                      </p>
                      <p className={`truncate text-xs ${workspaceTextMuted}`}>
                        {item.reasons.slice(0, 2).join(' · ') ||
                          `${item.score}% fit`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)] tabular-nums">
                        {item.score}%
                      </span>
                      <Button asChild size="sm" variant="outline">
                        <Link
                          href={accountPath(
                            accountSlug,
                            pathsConfig.app.accountListingDetail,
                          ).replace('[id]', item.listingId)}
                        >
                          Open
                        </Link>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </section>
      ) : null}

      <section className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Card className={`${workspacePanelCard} min-w-0 overflow-hidden`}>
          <CardContent className="p-4 sm:p-5">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
                  Recent disposals
                </h3>
                <p className={`text-sm ${workspaceTextMuted}`}>
                  Latest instructions and marketing stock
                </p>
              </div>
              <Link
                href={listingsHref}
                className={`${workspaceLinkAccent} shrink-0 whitespace-nowrap`}
              >
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
                {recentListings.map((listing) => {
                  const statusLabel =
                    LISTING_STATUS_LABELS[listing.status as ListingStatus] ??
                    listing.status;

                  return (
                    <li key={listing.id} className="min-w-0">
                      <Link
                        href={accountPath(
                          accountSlug,
                          pathsConfig.app.accountListingDetail,
                        ).replace('[id]', listing.id)}
                        className="flex min-w-0 items-center gap-3 py-3 transition-colors hover:text-[var(--ozer-accent)]"
                      >
                        <span className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--workspace-shell-sidebar-accent)]">
                          {listing.coverUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={listing.coverUrl}
                              alt=""
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Building2
                              className={`h-4 w-4 ${workspaceTextMuted}`}
                            />
                          )}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                            {listing.name}
                          </p>
                          <p
                            className={`truncate text-xs ${workspaceTextMuted}`}
                          >
                            {listingLocation(listing) || 'No location'} ·{' '}
                            {DISPOSAL_TYPE_LABELS[
                              listing.disposalType as DisposalType
                            ] ?? listing.disposalType}
                          </p>
                        </div>
                        <span
                          title={statusLabel}
                          className="mt-0.5 max-w-[7.5rem] shrink-0 truncate rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-[10px] font-medium text-[var(--workspace-shell-text)]/70 sm:mt-0 sm:max-w-[9rem] sm:px-2.5 sm:text-[11px]"
                        >
                          {statusLabel}
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={`${workspacePanelCard} min-w-0 overflow-hidden`}>
          <CardContent className="p-4 sm:p-5">
            <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Quick links
            </h3>
            <p className={`mt-1 text-sm ${workspaceTextMuted}`}>
              Jump into the core agency modules
            </p>
            <div className="mt-4 grid grid-cols-4 gap-2">
              {[
                {
                  href: requirementsHref,
                  label: 'Requirements',
                  icon: ClipboardList,
                },
                { href: pipelineHref, label: 'WIP', icon: Tag },
                { href: viewingsHref, label: 'Viewings', icon: CalendarDays },
                { href: reportsHref, label: 'Insights', icon: Building2 },
              ].map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex min-w-0 flex-col items-center justify-center gap-2 rounded-xl border border-[color:var(--workspace-shell-border)] px-1.5 py-3 text-center text-[var(--workspace-shell-text)] transition-colors hover:border-[var(--ozer-accent)]/35 hover:bg-[var(--workspace-shell-sidebar-accent)] sm:px-2"
                >
                  <item.icon
                    className={`h-5 w-5 shrink-0 ${workspaceTextMuted}`}
                  />
                  <span className="w-full truncate text-[11px] font-medium sm:text-xs">
                    {item.label}
                  </span>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
