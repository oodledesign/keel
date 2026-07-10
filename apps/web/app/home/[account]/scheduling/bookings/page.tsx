import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { BookingsList } from '../_components/bookings-list';
import { loadSchedulingAccess } from '../_lib/server/scheduling-page.loader';
import { createSchedulingService } from '../_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({
  title: 'Bookings · Scheduling',
});

async function BookingsPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);

  const service = createSchedulingService(getSupabaseServerClient());
  const { upcoming, past } = await service.listBookings(accountId);

  return (
    <BookingsList
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      upcoming={upcoming}
      past={past}
    />
  );
}

export default withI18n(BookingsPage);
