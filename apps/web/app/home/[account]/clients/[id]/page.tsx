import { notFound } from 'next/navigation';

import { PageBody } from '@kit/ui/page';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getAgencyBrandingByBusinessId } from '~/lib/agency-branding';

import { getTeamAccountAccess } from '../../_lib/role-access';
import { isWorkModuleEnabled } from '../../_lib/server/account-modules';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import {
  loadRanklyClientImportOptions,
  loadRanklyImportSeedForClient,
  loadRanklyProjectForClient,
} from '../../_lib/server/rankly-account-data';
import {
  BUSINESS_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../_lib/server/workspace-route-guard';
import { loadContextWorkspaceContent } from '../../_lib/workspace-content/context-loader';
import type { LinkOption, NoteListItem } from '../../_lib/workspace-content/types';
import type { DocListItem } from '../../_lib/workspace-content/types';
import type { LinkValue } from '../../_components/workspace-content/link-to-select';
import { notesVariantFromProfile, resolveWorkspaceProfile } from '../../_lib/server/workspace-profile';
import { loadClientsPageData } from '../_lib/server/clients-page.loader';
import { createClientsService } from '../_lib/server/clients.service';
import { ClientDetailPageContent } from '../_components/client-detail-page-content';
import { ClientDetailPageNav } from '../_components/client-detail-page-nav';

type Props = {
  params: Promise<{ account: string; id: string }>;
};

export default async function ClientDetailPage({ params }: Props) {
  const { account: accountSlug, id: clientId } = await params;

  const workspace = await loadTeamWorkspace(accountSlug);
  if (!workspace?.account) notFound();

  redirectIfSpaceNotIn(workspace, accountSlug, BUSINESS_WORKSPACE_SPACE_TYPES);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );
  if (
    !access.canViewClients ||
    !isWorkModuleEnabled(workspace.moduleSettings, 'clients')
  ) {
    notFound();
  }

  const { accountId, canEditClients, isContractorView } =
    await loadClientsPageData(accountSlug);

  const clientsService = createClientsService(getSupabaseServerClient());
  let client: Awaited<ReturnType<typeof clientsService.getClient>> | null = null;
  try {
    client = await clientsService.getClient({ accountId, clientId });
  } catch (error) {
    console.error('[client-detail] getClient failed', error);
    notFound();
  }
  if (!client) notFound();

  const clientsListHref = pathsConfig.app.accountClients.replace(
    '[account]',
    accountSlug,
  );
  const accountHomeHref = pathsConfig.app.accountHome.replace(
    '[account]',
    accountSlug,
  );

  const agencyBranding = await getAgencyBrandingByBusinessId(accountId);
  const portalHref = agencyBranding?.slug
    ? pathsConfig.app.clientPortalHome.replace('[clientSlug]', agencyBranding.slug)
    : null;

  const clientRecord = client as {
    display_name?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  };
  const clientDisplayName =
    clientRecord.display_name?.trim() ||
    [clientRecord.first_name, clientRecord.last_name].filter(Boolean).join(' ').trim() ||
    'Client';

  const workspaceProfile = resolveWorkspaceProfile({
    space_type: (workspace.account as { space_type?: string }).space_type,
    business_type: workspace.businessType,
  });

  let workspaceNotes: NoteListItem[] = [];
  let workspaceDocs: DocListItem[] = [];
  let notesTableAvailable = false;
  let docsTableAvailable = false;
  let linkOptions: LinkOption[] = [];
  let defaultLink: LinkValue = { type: 'client', id: clientId };

  try {
    const workspaceContent = await loadContextWorkspaceContent({
      accountId,
      spaceType: (workspace.account as { space_type?: string }).space_type,
      businessType: workspace.businessType,
      scope: { clientOrgId: clientId },
    });
    workspaceNotes = workspaceContent.notes;
    workspaceDocs = workspaceContent.docs;
    notesTableAvailable = workspaceContent.notesTableAvailable;
    docsTableAvailable = workspaceContent.docsTableAvailable;
    linkOptions = workspaceContent.linkOptions;
    defaultLink = workspaceContent.defaultLink;
  } catch (error) {
    console.error('[client-detail] workspace content failed', error);
  }

  const notesVariant = notesVariantFromProfile(workspaceProfile);

  const ranklyEnabled = isWorkModuleEnabled(workspace.moduleSettings, 'rankly');
  let ranklyProject = null;
  let ranklyImportSeed = null;
  let ranklyClientImportOptions: Awaited<
    ReturnType<typeof loadRanklyClientImportOptions>
  > = [];

  if (ranklyEnabled) {
    try {
      [ranklyProject, ranklyImportSeed, ranklyClientImportOptions] =
        await Promise.all([
          loadRanklyProjectForClient(accountId, clientId),
          loadRanklyImportSeedForClient(accountId, clientId),
          loadRanklyClientImportOptions(accountId),
        ]);
    } catch (error) {
      console.error('[client-detail] rankly data failed', error);
    }
  }

  return (
    <PageBody className="flex min-h-0 flex-1 flex-col bg-[var(--workspace-shell-canvas)] px-0 py-4 md:px-6 md:py-6">
      <ClientDetailPageNav
        accountHomeHref={accountHomeHref}
        clientsListHref={clientsListHref}
        clientDisplayName={clientDisplayName}
      />
      <div className="mt-4 flex min-h-0 flex-1 flex-col">
        <ClientDetailPageContent
          accountSlug={accountSlug}
          accountId={accountId}
          clientId={clientId}
          canEditClients={canEditClients}
          isContractorView={isContractorView}
          clientsListHref={clientsListHref}
          portalHref={portalHref}
          workspaceNotes={workspaceNotes}
          workspaceDocs={workspaceDocs}
          notesTableAvailable={notesTableAvailable}
          docsTableAvailable={docsTableAvailable}
          linkOptions={linkOptions}
          defaultLink={defaultLink}
          notesVariant={notesVariant}
          ranklyEnabled={ranklyEnabled}
          ranklyProject={ranklyProject}
          ranklyImportSeed={ranklyImportSeed}
          ranklyClientImportOptions={ranklyClientImportOptions}
        />
      </div>
    </PageBody>
  );
}
