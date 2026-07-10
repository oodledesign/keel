import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { BookingPagesList } from './_components/booking-pages-list';
import { loadSchedulingAccess } from './_lib/server/scheduling-page.loader';
import { createSchedulingService } from './_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string }>;
}

export const generateMetadata = async () => ({ title: 'Scheduling' });

async function SchedulingPagesPage({ params }: Props) {
  const accountSlugParam = (await params).account;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(accountSlugParam);

  const service = createSchedulingService(getSupabaseServerClient());
  const pages = await service.listBookingPages(accountId);

  return (
    <BookingPagesList
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      pages={pages}
    />
  );
}

export default withI18n(SchedulingPagesPage);
