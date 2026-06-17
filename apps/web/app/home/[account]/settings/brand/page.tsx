import { redirect } from 'next/navigation';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { loadAccountBranches } from '~/lib/brand/account-branches';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { BrandSettingsForm } from '../_components/brand-settings-form';
import { BrandBranchesSection } from '../_components/brand-branches-section';

export const generateMetadata = async () => ({
  title: 'Brand settings',
});

interface BrandSettingsPageProps {
  params: Promise<{ account: string }>;
}

export default async function BrandSettingsPage(props: BrandSettingsPageProps) {
  const { account } = await props.params;
  const workspace = await loadTeamWorkspace(account);
  redirectIfSpaceNotIn(workspace, account, ['work']);

  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(
      getDefaultAccountPath(
        account,
        workspace.account as {
          permissions?: string[] | null;
          role?: string | null;
          company_role?: string | null;
        },
      ),
    );
  }

  const accountId = workspace.account.id as string;
  const [brand, branches] = await Promise.all([
    loadAccountBrandResolved(accountId),
    loadAccountBranches(accountId),
  ]);
  const canEditBrand = access.isOwner || access.isAdmin;

  return (
    <div className="flex flex-col gap-6">
      <BrandSettingsForm
        accountId={accountId}
        accountSlug={account}
        initialBrand={brand}
        canEdit={canEditBrand}
      />
      <BrandBranchesSection
        accountId={accountId}
        initialBranches={branches}
        canEdit={canEditBrand}
      />
    </div>
  );
}
