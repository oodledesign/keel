import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WebsiteDetailContent } from '../_components/website-detail-content';
import { loadWebsitesPageData } from '../_lib/server/websites-page.loader';
import { createWebsitesService } from '../_lib/server/websites.service';

interface WebsiteDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: WebsiteDetailPageProps) => {
  const { id } = await params;
  return { title: `Website – ${id}` };
};

async function WebsiteDetailPage({ params }: WebsiteDetailPageProps) {
  const { account: accountSlug, id: websiteId } = await params;
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
  const website = await service.getWebsite({ accountId, websiteId });

  if (!website) {
    notFound();
  }

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
          canEditWebsites={canEditWebsites}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WebsiteDetailPage);
