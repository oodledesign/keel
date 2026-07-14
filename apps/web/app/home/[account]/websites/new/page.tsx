import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { createClientsService } from '~/home/[account]/clients/_lib/server/clients.service';
import { withI18n } from '~/lib/i18n/with-i18n';
import { hasSiteStudio } from '~/lib/websites/has-site-studio';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WebsiteForm } from '../_components/website-form';
import { loadWebsitesPageData } from '../_lib/server/websites-page.loader';

interface WebsiteNewPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Add website' };
};

async function WebsiteNewPage({ params }: WebsiteNewPageProps) {
  const accountSlug = (await params).account;
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

  const siteStudioEnabled = await hasSiteStudio(accountId);
  const clientsResult = await createClientsService(getSupabaseServerClient())
    .listClients({ accountId, page: 1, pageSize: 100 })
    .catch(() => ({ data: [] as Array<Record<string, unknown>> }));

  const clientOptions = (clientsResult.data ?? []).map(
    (row: {
      id: string;
      display_name?: string | null;
      company_name?: string | null;
    }) => ({
      id: String(row.id),
      label:
        String(row.display_name ?? row.company_name ?? 'Untitled').trim() ||
        'Untitled',
    }),
  );

  return (
    <>
      <TeamAccountLayoutPageHeader
        title="Add website"
        description="Create a new website record for this workspace"
        account={accountSlug}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <WebsiteForm
          mode="create"
          accountId={accountId}
          accountSlug={accountSlug}
          siteStudioEnabled={siteStudioEnabled}
          initialClients={clientOptions}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WebsiteNewPage);
