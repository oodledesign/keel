import { loadAccountBranches } from '~/lib/brand/account-branches';
import { loadSignatureAssets } from '~/lib/signatures/signature-assets';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesAssetsPanel } from '../../_components/signatures-assets-panel';
import {
  loadDepartments,
  loadSignaturesWorkspace,
} from '../../_lib/server/signatures-data';

type PageProps = {
  params: Promise<{ account: string }>;
};

export default async function SignaturesCustomDataPage({ params }: PageProps) {
  const { account } = await params;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [assets, departments, branches] = await Promise.all([
    loadSignatureAssets(accountId),
    loadDepartments(accountId),
    loadAccountBranches(accountId),
  ]);

  return (
    <ModuleDataSection
      title="Custom data"
      description="Shared signature assets, department badges, and branch details used across templates."
    >
      <SignaturesAssetsPanel
        accountId={accountId}
        assets={assets}
        departments={departments}
        branches={branches}
      />
    </ModuleDataSection>
  );
}
