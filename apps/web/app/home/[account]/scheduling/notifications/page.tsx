import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { withI18n } from '~/lib/i18n/with-i18n';

import { NotificationsForm } from '../_components/notifications-form';
import { loadSchedulingAccess } from '../_lib/server/scheduling-page.loader';
import { createSchedulingService } from '../_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Notifications · Scheduling',
});

async function NotificationsPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);

  const client = getSupabaseServerClient();
  const service = createSchedulingService(client);
  const [settings, brand, accountResult] = await Promise.all([
    service.getNotificationSettings(accountId),
    loadAccountBrandResolved(accountId),
    client.from('accounts').select('name').eq('id', accountId).maybeSingle(),
  ]);

  const workspaceName = accountResult.data?.name?.trim() || accountSlug;

  return (
    <NotificationsForm
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      settings={settings}
      brand={{
        primaryColor: brand.primary_color,
        accentColor: brand.accent_color,
        logoUrl: brand.logo_url,
        workspaceName,
      }}
    />
  );
}

export default withI18n(NotificationsPage);
