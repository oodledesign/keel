import { notFound, redirect } from 'next/navigation';

import featureFlagsConfig from '~/config/feature-flags.config';
import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { WorkspaceBillingPanel } from '../_components/workspace-billing-panel';

interface WorkspaceBillingSettingsPageProps {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    addon?: string;
    setup?: string;
    upgrade?: string;
    billing?: string;
    payment_updated?: string;
  }>;
}

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();
  return { title: i18n.t('teams:billing.pageTitle') };
};

async function WorkspaceBillingSettingsPage({
  params,
  searchParams,
}: WorkspaceBillingSettingsPageProps) {
  if (!featureFlagsConfig.enableTeamAccountBilling) {
    notFound();
  }

  const accountSlug = (await params).account;
  const query = await searchParams;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewBilling) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  return (
    <WorkspaceBillingPanel accountSlug={accountSlug} searchParams={query} />
  );
}

export default withI18n(WorkspaceBillingSettingsPage);
