import { redirect } from 'next/navigation';

import { withI18n } from '~/lib/i18n/with-i18n';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import {
  getDefaultAccountPath,
  getTeamAccountAccess,
} from '../../_lib/role-access';
import { loadTeamWorkspace } from '../../_lib/server/team-account-workspace.loader';
import { EmailNotificationPreferencesForm } from '../_components/email-notification-preferences-form';
import { loadEmailNotificationPreferences } from '../_lib/server/email-notification-preferences.loader';

interface NotificationsSettingsPageProps {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => {
  return { title: 'Notifications' };
};

async function TeamNotificationsSettingsPage({
  params,
}: NotificationsSettingsPageProps) {
  const slug = (await params).account;
  const user = await requireUserInServerComponent();
  const workspace = await loadTeamWorkspace(slug);
  const access = getTeamAccountAccess(
    workspace.account as {
      permissions?: string[] | null;
      role?: string | null;
      company_role?: string | null;
    },
  );

  if (!access.canViewSettings) {
    redirect(getDefaultAccountPath(slug, workspace.account));
  }

  const preferences = await loadEmailNotificationPreferences(user.id);

  return <EmailNotificationPreferencesForm initialPreferences={preferences} />;
}

export default withI18n(TeamNotificationsSettingsPage);
