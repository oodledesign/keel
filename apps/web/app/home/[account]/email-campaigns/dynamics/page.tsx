import { PageBody } from '@kit/ui/page';

import { withI18n } from '~/lib/i18n/with-i18n';

import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { getTeamAccountAccess } from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { CampaignDynamicsPanel } from '../_components/campaign-dynamics-panel';
import { CampaignsHubNav } from '../_components/campaigns-hub-nav';
import {
  loadDynamicsConnection,
  loadDynamicsInboundStub,
} from '../_lib/server/dynamics.loader';

interface DynamicsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Dynamics 365',
});

async function DynamicsPage({ params }: DynamicsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );
  const [connection, inbound] = await Promise.all([
    loadDynamicsConnection(workspace.account.id),
    Promise.resolve(loadDynamicsInboundStub()),
  ]);

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={accountSlug}
        title="Dynamics 365"
        description="Connect Dataverse so mailing-list signups upsert Contacts with marketing consent. Ozer stays the emailable source of truth."
      />
      <PageBody className="space-y-6 bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-8">
        <CampaignsHubNav accountSlug={accountSlug} />
        <CampaignDynamicsPanel
          accountId={workspace.account.id}
          accountSlug={accountSlug}
          connection={connection}
          canEdit={access.isOwner || access.isAdmin}
          inboundNote={inbound.summary}
        />
      </PageBody>
    </>
  );
}

export default withI18n(DynamicsPage);
