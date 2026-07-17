import { notFound, redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../../_lib/role-access';
import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import { WebsiteForm } from '../../_components/website-form';
import { loadWebsitesPageData } from '../../_lib/server/websites-page.loader';
import { createWebsitesService } from '../../_lib/server/websites.service';

interface WebsiteEditPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({ params }: WebsiteEditPageProps) => {
  const { id } = await params;
  return { title: `Edit website – ${id}` };
};

async function WebsiteEditPage({ params }: WebsiteEditPageProps) {
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

  if (!canEditWebsites) {
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
        title={`Edit: ${website.name}`}
        description="Update website details"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <WebsiteForm
          mode="edit"
          accountId={accountId}
          accountSlug={accountSlug}
          website={website}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WebsiteEditPage);
