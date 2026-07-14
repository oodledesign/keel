import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { createJobsService } from '~/home/[account]/jobs/_lib/server/jobs.service';
import { createProjectPhasesService } from '~/home/[account]/jobs/_lib/server/project-phases.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { deliveryProjectTitle } from '~/lib/projects/project-types';
import { hasSiteStudio } from '~/lib/websites/has-site-studio';
import {
  ALL_PLANNING_TABS,
  type WebsitePlanningTab,
  emptySiteStudioBundle,
} from '~/lib/websites/planning-types';

import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WebsiteDetailContent } from '../_components/website-detail-content';
import { createSiteStudioService } from '../_lib/server/site-studio.service';
import { createWebsiteApprovalsService } from '../_lib/server/website-approvals.service';
import {
  createWebsitePlanningService,
  emptyWebsitePlanningBundle,
} from '../_lib/server/website-planning.service';
import { loadWebsitesPageData } from '../_lib/server/websites-page.loader';
import { createWebsitesService } from '../_lib/server/websites.service';

interface WebsiteDetailPageProps {
  params: Promise<{ account: string; id: string }>;
  searchParams: Promise<{ plan?: string }>;
}

export const generateMetadata = async ({ params }: WebsiteDetailPageProps) => {
  const { id } = await params;
  return { title: `Website – ${id}` };
};

async function WebsiteDetailPage({
  params,
  searchParams,
}: WebsiteDetailPageProps) {
  const { account: accountSlug, id: websiteId } = await params;
  const { plan } = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const { accountId, canViewWebsites, canEditWebsites } =
    await loadWebsitesPageData(accountSlug);

  if (!canViewWebsites) {
    redirect(
      getDefaultAccountPath(
        accountSlug,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const client = getSupabaseServerClient();
  const service = createWebsitesService(client);
  const planningService = createWebsitePlanningService(client);
  const siteStudioService = createSiteStudioService(client);
  const website = await service.getWebsite({ accountId, websiteId });

  if (!website) {
    notFound();
  }

  const planning =
    (await planningService.getPlanningBundle(accountId, websiteId)) ??
    emptyWebsitePlanningBundle(websiteId);

  const siteStudioEnabled = await hasSiteStudio(accountId);
  const siteStudio = await siteStudioService
    .getBundle(accountId, websiteId, siteStudioEnabled)
    .catch(() => emptySiteStudioBundle());

  let linkedJobTitle: string | null = null;
  let phases: Awaited<
    ReturnType<
      ReturnType<typeof createProjectPhasesService>['listPhasesForJob']
    >
  > = [];

  if (planning.jobId) {
    const [job, phaseRows] = await Promise.all([
      createJobsService(client)
        .getJob({ accountId, jobId: planning.jobId })
        .catch(() => null),
      createProjectPhasesService(client)
        .listPhasesForJob({ accountId, jobId: planning.jobId })
        .catch(() => []),
    ]);
    if (job) {
      linkedJobTitle = deliveryProjectTitle(job);
    }
    phases = phaseRows;
  }

  const planningTab =
    plan && ALL_PLANNING_TABS.includes(plan as WebsitePlanningTab)
      ? (plan as WebsitePlanningTab)
      : undefined;

  const approvals = siteStudioEnabled
    ? await createWebsiteApprovalsService(client)
        .listForWebsite(accountId, websiteId)
        .catch(() => [])
    : [];

  return (
    <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <WebsiteDetailContent
        website={website}
        accountSlug={accountSlug}
        accountId={accountId}
        canEditWebsites={canEditWebsites}
        planning={planning}
        siteStudio={siteStudio}
        siteStudioEnabled={siteStudioEnabled}
        planningTab={planningTab}
        linkedJobTitle={linkedJobTitle}
        phases={phases}
        approvals={approvals}
      />
    </PageBody>
  );
}

export default withI18n(WebsiteDetailPage);
