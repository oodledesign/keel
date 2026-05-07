import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import {
  loadDepartmentBadges,
  loadDepartments,
  loadMsConnection,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';

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
  const [connection, departmentBadges, departments] = await Promise.all([
    loadMsConnection(accountId),
    loadDepartmentBadges(accountId),
    loadDepartments(accountId),
  ]);

  return (
    <ModuleDataSection
      title="Settings"
      description="Manage the Microsoft 365 connection used by the signatures module."
    >
      <SignaturesSettingsPanel
        accountId={accountId}
        accountSlug={account}
        connection={connection}
        connected={sp.connected === 'true'}
        departmentBadges={departmentBadges}
        departments={departments}
      />
    </ModuleDataSection>
  );
}
