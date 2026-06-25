import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { getDefaultAccountPath } from '../_lib/role-access';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { loadWebsitesPageData } from './_lib/server/websites-page.loader';
import { createWebsitesService } from './_lib/server/websites.service';
import { WebsitesPageContent } from './_components/websites-page-content';

interface WebsitesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Websites' };
};

async function WebsitesPage({ params }: WebsitesPageProps) {
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

  const service = createWebsitesService(getSupabaseServerClient());
  const initialWebsites = await service.listWebsites({ accountId });

  return (
    <>
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
        <WebsitesPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          canEditWebsites={canEditWebsites}
          initialWebsites={initialWebsites}
        />
      </PageBody>
    </>
  );
}

export default withI18n(WebsitesPage);
