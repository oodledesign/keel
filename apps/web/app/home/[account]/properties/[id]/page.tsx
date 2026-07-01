import { notFound, redirect } from 'next/navigation';

import Link from 'next/link';

import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getDefaultAccountPath, getTeamAccountAccess } from '../../_lib/role-access';
import { getSpaceTypeFromAccount } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { loadContextWorkspaceContent } from '../../_lib/workspace-content/context-loader';
import { notesVariantFromProfile } from '../../_lib/server/workspace-profile';
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

  await requireUserInServerComponent();
  const client = getSupabaseServerClient();
  const service = createPropertiesService(client);

  const property = await service.getProperty(propertyId);

  if (!property) {
    notFound();
  }

  const workspaceContent = await loadContextWorkspaceContent({
    accountId: workspace.account.id as string,
    spaceType: (workspace.account as { space_type?: string }).space_type,
    businessType: workspace.businessType,
    scope: { propertyId },
  });

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={slug}
        title="Property"
        description={
          <Link
            href={pathsConfig.app.accountProperties.replace('[account]', slug)}
            className="text-sm text-[var(--workspace-shell-text-muted)] transition-colors hover:text-[var(--workspace-shell-accent-text)]"
          >
            ← Back to all properties
          </Link>
        }
      />
      <PageBody className="bg-[var(--workspace-shell-canvas)] px-0 py-6 lg:px-6">
        <PropertyDetailContent
          property={property}
          accountId={workspace.account.id as string}
          accountSlug={slug}
          workspaceNotes={workspaceContent.notes}
          workspaceDocs={workspaceContent.docs}
          notesTableAvailable={workspaceContent.notesTableAvailable}
          docsTableAvailable={workspaceContent.docsTableAvailable}
          linkOptions={workspaceContent.linkOptions}
          defaultLink={workspaceContent.defaultLink}
          notesVariant={notesVariantFromProfile(workspaceContent.profile)}
        />
      </PageBody>
    </>
  );
}

export default withI18n(PropertyDetailPage);
