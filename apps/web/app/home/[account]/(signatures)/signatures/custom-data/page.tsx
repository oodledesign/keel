import { loadAccountBranches } from '~/lib/brand/account-branches';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { loadSignatureAssets } from '~/lib/signatures/signature-assets';
import { loadSignaturesWorkspaceSettings } from '~/lib/signatures/workspace-settings';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesAssetsPanel } from '../../_components/signatures-assets-panel';
import { SignaturesCompanyAssetsCard } from '../../_components/signatures-company-assets-card';
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
  const [assets, departments, branches, brand, workspaceSettings] =
    await Promise.all([
      loadSignatureAssets(accountId),
      loadDepartments(accountId),
      loadAccountBranches(accountId),
      loadAccountBrandResolved(accountId),
      loadSignaturesWorkspaceSettings(accountId),
    ]);

  return (
    <ModuleDataSection
      title="Custom data"
      description="Shared signature assets, company logos, department badges, and branch details used across templates."
    >
      <SignaturesCompanyAssetsCard
        accountId={accountId}
        companyLogoUrl={workspaceSettings.company_logo_url}
        companyIconUrl={workspaceSettings.company_icon_url}
        brandLogoUrl={brand.logo_url}
      />
      <SignaturesAssetsPanel
        accountId={accountId}
        assets={assets}
        departments={departments}
        branches={branches}
      />
    </ModuleDataSection>
  );
}
