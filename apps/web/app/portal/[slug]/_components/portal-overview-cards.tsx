import Link from 'next/link';

import {
  Briefcase,
  CreditCard,
  ExternalLink,
  Globe,
  LifeBuoy,
  MessageSquare,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { ProfileAvatar } from '@kit/ui/profile-avatar';

import pathsConfig from '~/config/paths.config';
import { WebsiteStatusBadge } from '~/home/[account]/websites/_components/website-badges';
import type { WebsiteStatus } from '~/home/[account]/websites/_lib/schema/websites.schema';
import { shouldNamePortalPlanProject } from '~/lib/billing/client-subscription-lifecycle';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';
import { portalCreditsNextSteps } from '~/lib/credits/portal-overview-credits';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import type {
  PortalChatThread,
  PortalOverviewData,
  PortalOverviewTask,
  PortalProjectSummary,
  PortalTicket,
} from '../_lib/server/client-portal.service';
import type { PortalCreditsSnapshot } from '../_lib/server/portal-credits.loader';
import {
  PortalTicketStatusBadge,
  formatPortalDate,
  formatPortalRelativeTime,
  formatPortalTicketNumber,
  portalExternalHref,
} from './portal-badges';
import { PortalMessageActions } from './portal-message-actions';
import { PortalOverviewCreditsChip } from './portal-overview-credits-chip';
import { PortalOverviewTasksCard } from './portal-overview-tasks-card';
import { PortalPendingRetainerPayList } from './portal-pending-retainer-pay-card';
import { PortalServiceRequestActions } from './portal-service-request-actions';

export async function OverviewHeader({
  slug,
  displayName,
  creditsPromise,
}: {
  slug: string;
  displayName: string;
  creditsPromise: Promise<PortalCreditsSnapshot | null>;
}) {
  const credits = await creditsPromise;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Welcome back, {displayName}
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Here&apos;s what&apos;s happening with your account.
        </p>
      </div>
      {credits ? (
        <PortalOverviewCreditsChip
          clientSlug={slug}
          balance={credits.balance}
          nextRenewalDate={credits.nextRenewalDate}
        />
      ) : null}
    </div>
  );
}

export async function OverviewProjectsCard({
  slug,
  showProjectsNav,
  projectsPromise,
}: {
  slug: string;
  showProjectsNav: boolean;
  projectsPromise: Promise<PortalProjectSummary[]>;
}) {
  const projects = await projectsPromise;
  if (!showProjectsNav && projects.length === 0) return null;

  const projectsHref = pathsConfig.app.clientPortalProjects.replace(
    '[clientSlug]',
    slug,
  );
  const previewProjects = projects.slice(0, 4);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Projects</CardTitle>
        <Briefcase className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      </CardHeader>
      <CardContent className="space-y-3">
        {previewProjects.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            No projects have been shared yet.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
            {previewProjects.map((project) => (
              <li key={project.id}>
                <Link
                  href={pathsConfig.app.clientPortalProjectDetail
                    .replace('[clientSlug]', slug)
                    .replace('[projectId]', project.id)}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <ProfileAvatar
                    displayName={project.name}
                    pictureUrl={toSupabasePublicStorageUrl(project.pictureUrl)}
                    className="size-8 shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {project.name}
                    </p>
                    <p className="truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                      {project.status
                        ? project.status.replace(/_/g, ' ')
                        : 'Project'}
                      {project.isOngoing
                        ? ' · Ongoing'
                        : project.dueDate
                          ? ` · Due ${formatPortalDate(project.dueDate)}`
                          : null}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Button asChild size="sm" variant="outline">
          <Link href={projectsHref}>View projects</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

export async function OverviewTasksCard({
  slug,
  allTasksPromise,
  myTasksPromise,
}: {
  slug: string;
  allTasksPromise: Promise<PortalOverviewTask[]>;
  myTasksPromise: Promise<PortalOverviewTask[]>;
}) {
  const [allTasks, myTasks] = await Promise.all([
    allTasksPromise,
    myTasksPromise,
  ]);
  const tasksHref = pathsConfig.app.clientPortalMyTasks.replace(
    '[clientSlug]',
    slug,
  );
  const projectsHref = pathsConfig.app.clientPortalProjects.replace(
    '[clientSlug]',
    slug,
  );

  return (
    <PortalOverviewTasksCard
      allTasks={allTasks}
      myTasks={myTasks}
      myTasksHref={tasksHref}
      projectsHref={projectsHref}
    />
  );
}

export async function OverviewServicesCard({
  slug,
  overviewPromise,
  ticketsPromise,
  canRequestPromise,
}: {
  slug: string;
  overviewPromise: Promise<PortalOverviewData>;
  ticketsPromise: Promise<PortalTicket[]>;
  canRequestPromise: Promise<boolean>;
}) {
  const [overview, tickets, canRequest] = await Promise.all([
    overviewPromise,
    ticketsPromise,
    canRequestPromise,
  ]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Services</CardTitle>
        <LifeBuoy className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
          <span className="text-2xl font-semibold text-[var(--ozer-text-on-light)] tabular-nums">
            {overview.openTicketCount}
          </span>{' '}
          {overview.openTicketCount === 1 ? 'open ticket' : 'open tickets'}
        </p>
        {tickets.length > 0 ? (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
            {tickets.map((ticket) => (
              <li key={ticket.id}>
                <Link
                  href={pathsConfig.app.clientPortalSupportDetail
                    .replace('[clientSlug]', slug)
                    .replace('[id]', ticket.id)}
                  className="flex items-center gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {formatPortalTicketNumber(ticket.ticketNumber)}{' '}
                      {ticket.title}
                    </p>
                    <p className="mt-0.5 text-[11px] text-[var(--ozer-text-on-light-muted)]">
                      {formatPortalDate(ticket.createdAt)}
                    </p>
                  </div>
                  <PortalTicketStatusBadge status={ticket.status} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            No open tickets right now.
          </p>
        )}
        <PortalServiceRequestActions
          clientSlug={slug}
          canRequest={canRequest}
        />
      </CardContent>
    </Card>
  );
}

export async function OverviewMessagesCard({
  slug,
  threadsPromise,
}: {
  slug: string;
  threadsPromise: Promise<PortalChatThread[]>;
}) {
  const threads = await threadsPromise;
  const messagesHref = pathsConfig.app.clientPortalMessages.replace(
    '[clientSlug]',
    slug,
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Messages</CardTitle>
        <MessageSquare className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      </CardHeader>
      <CardContent className="space-y-3">
        {threads.length === 0 ? (
          <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
            No conversations yet. Start one with the team.
          </p>
        ) : (
          <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
            {threads.map((thread) => (
              <li key={thread.id}>
                <Link
                  href={`${messagesHref}?thread=${thread.id}`}
                  className="flex items-start gap-3 px-3 py-2.5 transition-colors hover:bg-[var(--workspace-shell-panel-hover)]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--ozer-text-on-light)]">
                      {thread.title}
                    </p>
                    <p className="mt-0.5 truncate text-[11px] text-[var(--ozer-text-on-light-muted)]">
                      {thread.lastMessagePreview ||
                        formatPortalRelativeTime(thread.lastMessageAt)}
                      {thread.lastMessagePreview
                        ? ` · ${formatPortalRelativeTime(thread.lastMessageAt)}`
                        : null}
                    </p>
                  </div>
                  {thread.hasUnread ? (
                    <span
                      className="mt-1.5 size-2 shrink-0 rounded-full bg-[var(--ozer-accent)]"
                      aria-label="Unread"
                    />
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
        <PortalMessageActions clientSlug={slug} />
      </CardContent>
    </Card>
  );
}

export async function OverviewPlanStrip({
  slug,
  overviewPromise,
  creditsPromise,
}: {
  slug: string;
  overviewPromise: Promise<PortalOverviewData>;
  creditsPromise: Promise<PortalCreditsSnapshot | null>;
}) {
  const [overview, credits] = await Promise.all([
    overviewPromise,
    creditsPromise,
  ]);
  const billingHref = pathsConfig.app.clientPortalBilling.replace(
    '[clientSlug]',
    slug,
  );
  const creditsHref = pathsConfig.app.clientPortalCredits.replace(
    '[clientSlug]',
    slug,
  );
  const liveSubscriptions =
    (overview.liveSubscriptions?.length ?? 0) > 0
      ? overview.liveSubscriptions
      : overview.subscription
        ? [overview.subscription]
        : [];
  const showProject = shouldNamePortalPlanProject(
    liveSubscriptions.length + overview.pendingSubscriptions.length,
  );
  const pendingItems = overview.pendingSubscriptions.map((sub) => ({
    id: sub.id,
    planName: sub.planName,
    amountPence: sub.monthlyAmount ?? 0,
    currency: sub.currency ?? 'gbp',
    projectName: sub.projectName,
    showProject,
  }));
  const nextSteps = portalCreditsNextSteps(
    credits?.balance ?? 0,
    credits?.nextRenewalDate ?? liveSubscriptions[0]?.nextBillingDate ?? null,
  );
  const hasPending = pendingItems.length > 0;
  const hasActive = liveSubscriptions.length > 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Current plan</CardTitle>
        <CreditCard className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      </CardHeader>
      <CardContent className="space-y-4">
        {hasPending ? (
          <div className="space-y-2">
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              Complete payment to activate
              {pendingItems.length === 1
                ? ' this retainer'
                : ' these retainers'}
              . Credits and services stay locked until then.
            </p>
            <PortalPendingRetainerPayList items={pendingItems} />
          </div>
        ) : null}

        {hasActive ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 space-y-3">
              {liveSubscriptions.map((sub) => (
                <div key={sub.id} className="space-y-1">
                  <p className="font-medium text-[var(--ozer-text-on-light)]">
                    {sub.planName}
                  </p>
                  {showProject && sub.projectName ? (
                    <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                      {sub.projectName}
                    </p>
                  ) : null}
                  <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                    {formatMinorUnits(
                      sub.monthlyAmount ?? 0,
                      sub.currency ?? 'gbp',
                    )}
                    /month
                  </p>
                  <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                    Next billing: {formatPortalDate(sub.nextBillingDate)}
                  </p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {nextSteps.topUp ? (
                <Button asChild size="sm">
                  <Link href={creditsHref}>Top up</Link>
                </Button>
              ) : null}
              {nextSteps.billing ? (
                <Button
                  asChild
                  size="sm"
                  variant={nextSteps.topUp ? 'outline' : 'default'}
                >
                  <Link href={billingHref}>Billing</Link>
                </Button>
              ) : (
                <Button asChild size="sm" variant="ghost">
                  <Link href={billingHref}>Billing details</Link>
                </Button>
              )}
            </div>
          </div>
        ) : hasPending ? null : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              No active subscription.
            </p>
            <Button asChild size="sm" variant="ghost">
              <Link href={billingHref}>Billing details</Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export async function OverviewWebsiteStrip({
  slug,
  overviewPromise,
}: {
  slug: string;
  overviewPromise: Promise<PortalOverviewData>;
}) {
  const overview = await overviewPromise;
  if (!overview.website) return null;

  const websiteHref = pathsConfig.app.clientPortalWebsite.replace(
    '[clientSlug]',
    slug,
  );
  const cmsUrl = portalExternalHref(overview.website.cmsAdminUrl);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-base font-medium">Website</CardTitle>
        <Globe className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
      </CardHeader>
      <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-medium text-[var(--ozer-text-on-light)]">
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
      </CardContent>
    </Card>
  );
}
