import { Suspense } from 'react';

import { Megaphone } from 'lucide-react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';

import { loadClientPortalContext } from '../_lib/server/client-portal.loader';
import {
  type PortalOverviewTask,
  createClientPortalService,
} from '../_lib/server/client-portal.service';
import {
  loadPortalCanRequestService,
  loadPortalCreditsSnapshot,
} from '../_lib/server/portal-credits.loader';
import { formatPortalDate } from './portal-badges';
import {
  OverviewHeader,
  OverviewMessagesCard,
  OverviewPlanStrip,
  OverviewProjectsCard,
  OverviewServicesCard,
  OverviewTasksCard,
  OverviewWebsiteStrip,
} from './portal-overview-cards';
import {
  OverviewCardSkeleton,
  OverviewHeaderSkeleton,
  OverviewPlanSkeleton,
} from './portal-overview-skeleton';

export default async function ClientPortalOverviewPage({
  slug,
}: {
  slug: string;
}) {
  const ctx = await loadClientPortalContext(slug);
  const service = createClientPortalService(getSupabaseServerClient());

  const projectsPromise = service.listPortalProjects(ctx.clientOrgId);
  const overviewPromise = service.getOverview(ctx.clientOrgId);
  const ticketsPromise = service.listTicketsPeek(ctx.clientOrgId, 3);
  const threadsPromise = ctx.showMessagesNav
    ? service.listParticipatingThreadsPeek(ctx.clientOrgId, 3)
    : Promise.resolve([]);
  const myTasksRawPromise = service.listPortalMyTasks(ctx.clientOrgId, {
    openOnly: true,
    limit: 12,
  });
  const allTasksPromise = projectsPromise.then((projects) =>
    service.listPortalOpenTasks(ctx.clientOrgId, 12, projects),
  );
  const myTasksPromise = myTasksRawPromise.then((tasks) =>
    tasks.map(
      (task): PortalOverviewTask => ({
        id: task.id,
        title: task.title,
        status: task.status,
        dueDate: task.dueDate,
        durationMinutes: task.durationMinutes,
        projectId: task.projectId,
        projectName: task.projectName,
        assigneeName: null,
      }),
    ),
  );
  const creditsPromise = loadPortalCreditsSnapshot(ctx.clientOrgId);
  const canRequestPromise = loadPortalCanRequestService(ctx.clientOrgId);

  return (
    <div className="space-y-8">
      <Suspense fallback={<OverviewHeaderSkeleton />}>
        <OverviewHeader
          slug={slug}
          displayName={ctx.displayName}
          creditsPromise={creditsPromise}
        />
      </Suspense>

      <div className="grid gap-4 md:grid-cols-2">
        <Suspense fallback={<OverviewCardSkeleton title="Projects" />}>
          <OverviewProjectsCard
            slug={slug}
            showProjectsNav={ctx.showProjectsNav}
            projectsPromise={projectsPromise}
          />
        </Suspense>
        <Suspense fallback={<OverviewCardSkeleton title="Tasks" />}>
          <OverviewTasksCard
            slug={slug}
            allTasksPromise={allTasksPromise}
            myTasksPromise={myTasksPromise}
          />
        </Suspense>
        <Suspense fallback={<OverviewCardSkeleton title="Services" />}>
          <OverviewServicesCard
            slug={slug}
            overviewPromise={overviewPromise}
            ticketsPromise={ticketsPromise}
            canRequestPromise={canRequestPromise}
          />
        </Suspense>
        {ctx.showMessagesNav ? (
          <Suspense fallback={<OverviewCardSkeleton title="Messages" />}>
            <OverviewMessagesCard slug={slug} threadsPromise={threadsPromise} />
          </Suspense>
        ) : null}
      </div>

      <Suspense fallback={<OverviewPlanSkeleton />}>
        <OverviewPlanStrip
          slug={slug}
          overviewPromise={overviewPromise}
          creditsPromise={creditsPromise}
        />
      </Suspense>

      <Suspense fallback={null}>
        <OverviewWebsiteStrip slug={slug} overviewPromise={overviewPromise} />
      </Suspense>

      <Suspense fallback={null}>
        <OverviewNotices overviewPromise={overviewPromise} />
      </Suspense>
    </div>
  );
}

async function OverviewNotices({
  overviewPromise,
}: {
  overviewPromise: ReturnType<
    ReturnType<typeof createClientPortalService>['getOverview']
  >;
}) {
  const overview = await overviewPromise;
  if (overview.notices.length === 0) return null;

  return (
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
  );
}
