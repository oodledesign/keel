import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesAssetsPanel } from '../../_components/signatures-assets-panel';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import { SignaturesIntegrationLinksCard } from '../../_components/signatures-integration-links-card';
import { SignaturesSettingsTabs } from '../../_components/signatures-settings-tabs';
import {
  loadDepartments,
  loadGoogleConnection,
  loadMsConnection,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';
import { loadAccountBranches } from '~/lib/brand/account-branches';
import { listIntegrationConnectInvites } from '~/lib/signatures/integration-invite';
import { loadSignatureAssets } from '~/lib/signatures/signature-assets';

type SignaturesSettingsPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ connected?: string; tab?: string }>;
};

export default async function SignaturesSettingsPage({
  params,
  searchParams,
}: SignaturesSettingsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [
    msConnection,
    googleConnection,
    assets,
    departments,
    branches,
    integrationInvites,
  ] = await Promise.all([
    loadMsConnection(accountId),
    loadGoogleConnection(accountId),
    loadSignatureAssets(accountId),
    loadDepartments(accountId),
    loadAccountBranches(accountId),
    listIntegrationConnectInvites(accountId),
  ]);

  const connected = sp.connected === 'true';
  const defaultTab =
    sp.tab === 'integrations' || connected ? 'integrations' : 'custom-data';
  const accountName =
    (workspace.account.name as string | null | undefined)?.trim() || account;

  return (
    <ModuleDataSection
      title="Settings"
      description="Manage shared signature data, and connect Microsoft 365 or Google Workspace."
    >
      <SignaturesSettingsTabs
        defaultTab={defaultTab}
        customData={
          <SignaturesAssetsPanel
            accountId={accountId}
            assets={assets}
            departments={departments}
            branches={branches}
          />
        }
        integrations={
          <>
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
              connected={connected}
            />
          </>
        }
      />
    </ModuleDataSection>
  );
}
