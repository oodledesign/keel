import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { PageBody } from '@kit/ui/page';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../_lib/role-access';
import { getSpaceTypeFromAccount } from '../_lib/server/account-modules';
import { loadTeamWorkspace } from '../_lib/server/team-account-workspace.loader';
import { PropertiesList } from './_components/properties-list';
import { createPropertiesService } from './_lib/server/properties.service';

interface PropertiesPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Properties` };
};

async function PropertiesPage({ params }: PropertiesPageProps) {
  const { account: slug } = await params;
  const workspace = await loadTeamWorkspace(slug);

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

  // Properties is available on 'work' and 'property' space types
  if (spaceType !== 'work' && spaceType !== 'property') {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewDashboard) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const service = createPropertiesService(getSupabaseServerClient());
  const properties = await service.listProperties(accountId);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Properties"
        description="Manage your property portfolio."
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 lg:px-6">
        <PropertiesList
          accountId={accountId}
          accountSlug={slug}
          initialProperties={properties}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PropertiesPage);
