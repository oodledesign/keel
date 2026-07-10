import { notFound } from 'next/navigation';

import { BookShell } from '../../_components/book-shell';
import { BookingWizard } from '../../_components/booking-wizard';
import { loadPublicEventType } from '../../_lib/server/public-booking.service';

interface Props {
  params: Promise<{ pageSlug: string; eventSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { pageSlug, eventSlug } = await params;
  const loaded = await loadPublicEventType(pageSlug, eventSlug);
  if (!loaded) return { title: 'Meeting not found' };
  return { title: `${loaded.eventType.name} · ${loaded.page.title}` };
}

export default async function PublicBookEventPage({ params }: Props) {
  const { pageSlug, eventSlug } = await params;
  const loaded = await loadPublicEventType(pageSlug, eventSlug);
  if (!loaded) notFound();

  return (
    <BookShell
      title={loaded.page.title}
      description={null}
      brandColour={loaded.page.brandColour}
    >
      <BookingWizard
        page={loaded.page}
        eventType={loaded.eventType}
        formFields={loaded.formFields}
      />
    </BookShell>
  );
}
