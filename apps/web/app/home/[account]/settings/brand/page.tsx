import { redirect } from 'next/navigation';

import { AppBreadcrumbs } from '@kit/ui/app-breadcrumbs';
import { PageBody } from '@kit/ui/page';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { redirectIfSpaceNotIn } from '../../_lib/server/workspace-route-guard';
import { TeamAccountLayoutPageHeader } from '../../_components/team-account-layout-page-header';
import { BrandSettingsForm } from '../_components/brand-settings-form';

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
    redirect(getDefaultAccountPath(account, workspace.account));
  }

  const accountId = workspace.account.id as string;
  const brand = await loadAccountBrandResolved(accountId);
  const canEditBrand = access.isOwner || access.isAdmin;

  return (
    <>
      <TeamAccountLayoutPageHeader
        account={account}
        title="Brand"
        description={<AppBreadcrumbs />}
      />

      <PageBody className="bg-[var(--workspace-shell-canvas)] px-4 py-6 text-[var(--workspace-shell-text)] lg:px-6">
        <BrandSettingsForm
          accountId={accountId}
          accountSlug={account}
          initialBrand={brand}
          canEdit={canEditBrand}
        />
      </PageBody>
    </>
  );
}
