import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WebsiteDetailContent } from '../_components/website-detail-content';
import { loadWebsitesPageData } from '../_lib/server/websites-page.loader';
import {
  createWebsitePlanningService,
  emptyWebsitePlanningBundle,
} from '../_lib/server/website-planning.service';
import { createWebsitesService } from '../_lib/server/websites.service';
import type { WebsitePlanningTab } from '~/lib/websites/planning-types';

interface WebsiteDetailPageProps {
  params: Promise<{ account: string; id: string }>;
  searchParams: Promise<{ plan?: string }>;
}

export const generateMetadata = async ({
  params,
}: WebsiteDetailPageProps) => {
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

  const service = createWebsitesService(getSupabaseServerClient());
  const planningService = createWebsitePlanningService(getSupabaseServerClient());
  const website = await service.getWebsite({ accountId, websiteId });

  if (!website) {
    notFound();
  }

  const planning =
    (await planningService.getPlanningBundle(accountId, websiteId)) ??
    emptyWebsitePlanningBundle(websiteId);

  const planningTab = ['overview', 'sitemap', 'wireframe', 'content'].includes(
    plan ?? '',
  )
    ? (plan as WebsitePlanningTab)
    : undefined;

  return (
    <>
      <TeamAccountLayoutPageHeader
        title={website.name}
        description="Website details"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <WebsiteDetailContent
          website={website}
          accountSlug={accountSlug}
          accountId={accountId}
          canEditWebsites={canEditWebsites}
          planning={planning}
          planningTab={planningTab}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WebsiteDetailPage);
