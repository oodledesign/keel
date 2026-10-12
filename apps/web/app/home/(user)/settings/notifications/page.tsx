import { EmailNotificationPreferencesForm } from '~/home/[account]/settings/_components/email-notification-preferences-form';
import { loadEmailNotificationPreferences } from '~/home/[account]/settings/_lib/server/email-notification-preferences.loader';
import { withI18n } from '~/lib/i18n/with-i18n';
import { EMAIL_NOTIFICATION_KEYS } from '~/lib/notifications/email-notification-preferences';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

export const generateMetadata = async () => {
  return { title: 'Notifications' };
};

async function PersonalNotificationsSettingsPage() {
  const user = await requireUserInServerComponent();
  const preferences = await loadEmailNotificationPreferences(user.id);

  return (
    <EmailNotificationPreferencesForm
      initialPreferences={preferences}
      keys={[...EMAIL_NOTIFICATION_KEYS]}
    />
  );
}

export default withI18n(PersonalNotificationsSettingsPage);
