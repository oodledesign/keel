import { notFound, redirect } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { getSpaceTypeFromAccount } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { createPropertiesService } from '../_lib/server/properties.service';
import { PropertyDetailContent } from './_components/property-detail-content';

interface PropertyDetailPageProps {
  params: Promise<{ account: string; id: string }>;
}

export const generateMetadata = async ({
  params,
}: PropertyDetailPageProps) => {
  const { account } = await params;
  const i18n = await createI18nServerInstance();
  const title = i18n.t('teams:home.pageTitle');
  return { title: `${title} – Property` };
};

async function PropertyDetailPage({ params }: PropertyDetailPageProps) {
  const { account: slug, id: propertyId } = await params;
  const workspace = await loadTeamWorkspace(slug);

  const spaceType = getSpaceTypeFromAccount(
    workspace.account as { space_type?: string | null },
  );

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

  const user = await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const service = createPropertiesService(client);

  const [property, documents] = await Promise.all([
    service.getProperty(propertyId),
    service.listDocuments(propertyId),
  ]);

  if (!property) {
    notFound();
  }

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title={property.name}
        description={property.address ?? 'Property details'}
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 lg:px-6">
        <PropertyDetailContent
          property={property}
          accountId={workspace.account.id as string}
          userId={user.id}
          documents={documents}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PropertyDetailPage);
