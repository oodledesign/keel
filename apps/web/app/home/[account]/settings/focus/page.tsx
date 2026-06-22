import { redirect } from 'next/navigation';

import { createI18nServerInstance } from '~/lib/i18n/i18n.server';
import { withI18n } from '~/lib/i18n/with-i18n';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { getWorkspaceFocusSettings } from './actions';
import { FocusSettingsForm } from './_components/FocusSettingsForm';

interface FocusSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const dynamic = 'force-dynamic';

export const generateMetadata = async () => {
  const i18n = await createI18nServerInstance();

  return {
    title: `${i18n.t('teams:settings.pageTitle')} — Focus & Availability`,
  };
};

async function FocusSettingsPage({ params }: FocusSettingsPageProps) {
  const accountSlug = (await params).account;
  const workspace = await loadTeamWorkspace(accountSlug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(accountSlug, workspace.account));
  }

  const settings = await getWorkspaceFocusSettings(workspace.account.id);

  return (
    <FocusSettingsForm
      accountId={workspace.account.id}
      accountSlug={accountSlug}
      userId={workspace.user.id}
      initialSettings={settings}
    />
  );
}

export default withI18n(FocusSettingsPage);
