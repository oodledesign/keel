import { notFound } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { withI18n } from '~/lib/i18n/with-i18n';

import { BookingPageEditor } from '../../_components/booking-page-editor';
import { loadSchedulingAccess } from '../../_lib/server/scheduling-page.loader';
import { createSchedulingService } from '../../_lib/server/scheduling.service';

interface Props {
  params: Promise<{ account: string; pageId: string }>;
}

export const generateMetadata = async () => ({ title: 'Booking page' });

async function SchedulingPageDetail({ params }: Props) {
  const { account, pageId } = await params;
  const { accountId, accountSlug, canEditScheduling } =
    await loadSchedulingAccess(account);

  const service = createSchedulingService(getSupabaseServerClient());
  const page = await service.getBookingPage(accountId, pageId);
  if (!page) notFound();

  const [eventTypes, schedules, conferencing] = await Promise.all([
    service.listEventTypes(page.id),
    service.listAvailabilitySchedules(accountId),
    service.listConferencingConnections(accountId),
  ]);

  const formFieldsByEventType: Record<
    string,
    Awaited<ReturnType<typeof service.listFormFields>>
  > = {};

  await Promise.all(
    eventTypes.map(async (eventType) => {
      formFieldsByEventType[eventType.id] = await service.listFormFields(
        eventType.id,
      );
    }),
  );

  return (
    <BookingPageEditor
      key={page.updatedAt}
      accountId={accountId}
      accountSlug={accountSlug}
      canEdit={canEditScheduling}
      page={page}
      eventTypes={eventTypes}
      schedules={schedules}
      formFieldsByEventType={formFieldsByEventType}
      conferencing={conferencing}
    />
  );
}

export default withI18n(SchedulingPageDetail);
