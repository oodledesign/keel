import { listIntegrationConnectInvites } from '~/lib/signatures/integration-invite';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesIntegrationLinksCard } from '../../_components/signatures-integration-links-card';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import {
  loadGoogleConnection,
  loadMsConnection,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';

type PageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ connected?: string }>;
};

export default async function SignaturesIntegrationsPage({
  params,
  searchParams,
}: PageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [msConnection, googleConnection, integrationInvites] =
    await Promise.all([
      loadMsConnection(accountId),
      loadGoogleConnection(accountId),
      listIntegrationConnectInvites(accountId),
    ]);

  const accountName =
    (workspace.account.name as string | null | undefined)?.trim() || account;

  return (
    <ModuleDataSection
      title="Integrations"
      description="Connect Microsoft 365 or Google Workspace, and share one-time admin invite links."
    >
      <div className="space-y-6">
        <SignaturesIntegrationLinksCard
          accountId={accountId}
          accountName={accountName}
          initialInvites={integrationInvites}
        />
        <SignaturesSettingsPanel
          accountId={accountId}
          accountSlug={account}
          msConnection={msConnection}
          googleConnection={googleConnection}
          connected={sp.connected === 'true'}
        />
      </div>
    </ModuleDataSection>
  );
}
