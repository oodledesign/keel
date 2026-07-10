import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { AvailabilityEditor } from '../_components/availability-editor';
import { loadSchedulingAccess } from '../_lib/server/scheduling-page.loader';
import { createSchedulingService } from '../_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Availability · Scheduling',
});

async function AvailabilityPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);

  const service = createSchedulingService(getSupabaseServerClient());
  const schedules = await service.listAvailabilitySchedules(accountId);

  return (
    <AvailabilityEditor
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      schedules={schedules}
    />
  );
}

export default withI18n(AvailabilityPage);
