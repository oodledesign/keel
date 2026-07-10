import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { ConnectedAccountsPanel } from '../_components/connected-accounts-panel';
import {
  loadConferencingOAuthStatus,
  loadGoogleCalendarStatusForScheduling,
  loadSchedulingAccess,
} from '../_lib/server/scheduling-page.loader';
import { createSchedulingService } from '../_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Connected accounts · Scheduling',
});

async function ConnectedAccountsPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling, user } =
    await loadSchedulingAccess(accountSlugParam);

  const service = createSchedulingService(getSupabaseServerClient());
  const [google, conferencing] = await Promise.all([
    loadGoogleCalendarStatusForScheduling(user.id, accountSlug),
    service.listConferencingConnections(accountId),
  ]);
  const { zoom, teams } = loadConferencingOAuthStatus(accountSlug);

  return (
    <ConnectedAccountsPanel
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      google={google}
      zoom={zoom}
      teams={teams}
      conferencing={conferencing}
    />
  );
}

export default withI18n(ConnectedAccountsPage);
