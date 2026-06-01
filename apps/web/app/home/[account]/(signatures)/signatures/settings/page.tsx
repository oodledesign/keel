import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesSettingsPanel } from '../../_components/signatures-settings-panel';
import {
  loadDepartmentBadges,
  loadDepartments,
  loadGoogleConnection,
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
  const [msConnection, googleConnection, departmentBadges, departments] =
    await Promise.all([
      loadMsConnection(accountId),
      loadGoogleConnection(accountId),
      loadDepartmentBadges(accountId),
      loadDepartments(accountId),
    ]);

  return (
    <ModuleDataSection
      title="Settings"
      description="Connect Microsoft 365 or Google Workspace to sync staff and push signatures."
    >
      <SignaturesSettingsPanel
        accountId={accountId}
        accountSlug={account}
        msConnection={msConnection}
        googleConnection={googleConnection}
        connected={sp.connected === 'true'}
        departmentBadges={departmentBadges}
        departments={departments}
      />
    </ModuleDataSection>
  );
}
