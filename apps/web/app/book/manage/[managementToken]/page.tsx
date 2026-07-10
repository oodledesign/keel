import { notFound } from 'next/navigation';

import { BookShell } from '../../_components/book-shell';
import { ManageBookingClient } from '../../_components/manage-booking-client';
import {
  loadBookingByManagementToken,
  loadEventTypeDurationsForBooking,
} from '../../_lib/server/public-booking.service';

interface Props {
  params: Promise<{ managementToken: string }>;
}

export async function generateMetadata() {
  return { title: 'Manage booking' };
}

export default async function ManageBookingPage({ params }: Props) {
  const { managementToken } = await params;

  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      managementToken,
    )
  ) {
    notFound();
  }

  const booking = await loadBookingByManagementToken(managementToken);
  if (!booking) notFound();

  const durations = await loadEventTypeDurationsForBooking(booking.eventTypeId);

  return (
    <BookShell
      title="Manage booking"
      description="Cancel or reschedule your meeting."
      brandColour={booking.brandColour}
    >
      <ManageBookingClient booking={booking} durations={durations} />
    </BookShell>
  );
}
