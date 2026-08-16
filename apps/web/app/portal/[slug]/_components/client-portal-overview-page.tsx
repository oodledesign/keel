import Link from 'next/link';

import {
  Briefcase,
  CreditCard,
  ExternalLink,
  Globe,
  LifeBuoy,
  Megaphone,
} from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { ProfileAvatar } from '@kit/ui/profile-avatar';

import pathsConfig from '~/config/paths.config';
import { WebsiteStatusBadge } from '~/home/[account]/websites/_components/website-badges';
import type { WebsiteStatus } from '~/home/[account]/websites/_lib/schema/websites.schema';
import { formatMinorUnits } from '~/lib/billing/plan-templates-types';
import { toSupabasePublicStorageUrl } from '~/lib/storage/public-url';

import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import {
  type PortalOverviewTask,
  createClientPortalService,
} from '../_lib/server/client-portal.service';
import { formatPortalDate, portalExternalHref } from './portal-badges';
import { PortalOverviewTasksCard } from './portal-overview-tasks-card';

export default async function ClientPortalOverviewPage({
  slug,
}: {
  slug: string;
}) {
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());
  const [overview, projects, allTasks, myTasksRaw] = await Promise.all([
    service.getOverview(ctx.clientOrgId),
    service.listPortalProjects(ctx.clientOrgId),
    service.listPortalOpenTasks(ctx.clientOrgId, 12),
    service.listPortalMyTasks(ctx.clientOrgId),
  ]);

  const myTasks: PortalOverviewTask[] = myTasksRaw
    .filter((task) => {
      const status = (task.status ?? '').toLowerCase();
      return (
        status !== 'done' && status !== 'completed' && status !== 'cancelled'
      );
    })
    .map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      dueDate: task.dueDate,
      projectId: task.projectId,
      projectName: task.projectName,
      assigneeName: null,
    }));

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
  const projectsHref = pathsConfig.app.clientPortalProjects.replace(
    '[clientSlug]',
    slug,
  );
  const tasksHref = pathsConfig.app.clientPortalMyTasks.replace(
    '[clientSlug]',
    slug,
  );

  const cmsUrl = overview.website
    ? portalExternalHref(overview.website.cmsAdminUrl)
    : null;

  const previewProjects = projects.slice(0, 4);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold text-[var(--ozer-text-on-light)]">
          Welcome back, {ctx.displayName}
        </h2>
        <p className="mt-1 text-sm text-[var(--ozer-text-on-light-muted)]">
          Here&apos;s what&apos;s happening with your account.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {ctx.showProjectsNav || projects.length > 0 ? (
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
                          pictureUrl={toSupabasePublicStorageUrl(
                            project.pictureUrl,
                          )}
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
        ) : null}

        <PortalOverviewTasksCard
          allTasks={allTasks}
          myTasks={myTasks}
          myTasksHref={tasksHref}
          projectsHref={projectsHref}
        />

        {overview.website ? (
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-base font-medium">Website</CardTitle>
              <Globe className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
            </CardHeader>
            <CardContent className="space-y-3">
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
        ) : null}

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">Services</CardTitle>
            <LifeBuoy className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-3xl font-semibold text-[var(--ozer-text-on-light)]">
              {overview.openTicketCount}
            </p>
            <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
              {overview.openTicketCount === 1 ? 'open ticket' : 'open tickets'}
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href={supportHref}>View services</Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-base font-medium">
              Current plan
            </CardTitle>
            <CreditCard className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
          </CardHeader>
          <CardContent className="space-y-2">
            {overview.subscription ? (
              <>
                <p className="font-medium text-[var(--ozer-text-on-light)]">
                  {overview.subscription.planName}
                </p>
                <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                  {formatMinorUnits(
                    overview.subscription.monthlyAmount ?? 0,
                    overview.subscription.currency ?? 'gbp',
                  )}
                  /month
                </p>
                <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                  Next billing:{' '}
                  {formatPortalDate(overview.subscription.nextBillingDate)}
                </p>
                <Button asChild size="sm" variant="ghost">
                  <Link href={billingHref}>Billing details</Link>
                </Button>
              </>
            ) : (
              <p className="text-sm text-[var(--ozer-text-on-light-muted)]">
                No active subscription.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {overview.notices.length > 0 ? (
        <section className="space-y-4">
          <div className="flex items-center gap-2">
            <Megaphone className="h-4 w-4 text-[var(--workspace-shell-text-muted)]" />
            <h3 className="text-lg font-semibold text-[var(--ozer-text-on-light)]">
              Noticeboard
            </h3>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            {overview.notices.map((notice) => (
              <Card key={notice.id}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">{notice.title}</CardTitle>
                  <p className="text-xs text-[var(--ozer-text-on-light-muted)]">
                    {formatPortalDate(notice.createdAt)}
                  </p>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap text-[var(--ozer-text-on-light-muted)]">
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
