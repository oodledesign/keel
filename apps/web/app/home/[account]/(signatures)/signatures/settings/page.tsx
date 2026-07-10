import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import { SignaturesIntegrationLinksCard } from '../../_components/signatures-integration-links-card';
import {
  loadDepartmentBadges,
  loadDepartments,
  loadGoogleConnection,
  loadMsConnection,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';
import { listIntegrationConnectInvites } from '~/lib/signatures/integration-invite';

type SignaturesSettingsPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{ connected?: string }>;
};

export default async function SignaturesSettingsPage({
  params,
  searchParams,
}: SignaturesSettingsPageProps) {
  const { account } = await params;
  const sp = await searchParams;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [msConnection, googleConnection, departmentBadges, departments, integrationInvites] =
    await Promise.all([
      loadMsConnection(accountId),
      loadGoogleConnection(accountId),
      loadDepartmentBadges(accountId),
      loadDepartments(accountId),
      listIntegrationConnectInvites(accountId),
    ]);

  return (
    <ModuleDataSection
      title="Settings"
      description="Connect Microsoft 365 or Google Workspace to sync staff and push signatures."
    >
      <div className="space-y-6">
        <SignaturesIntegrationLinksCard
          accountId={accountId}
          accountName={
            (workspace.account.name as string | null | undefined)?.trim() ||
            account
          }
          initialInvites={integrationInvites}
        />
        <SignaturesSettingsPanel
        accountId={accountId}
        accountSlug={account}
        msConnection={msConnection}
        googleConnection={googleConnection}
        connected={sp.connected === 'true'}
        departmentBadges={departmentBadges}
        departments={departments}
      />
      </div>
    </ModuleDataSection>
  );
}
