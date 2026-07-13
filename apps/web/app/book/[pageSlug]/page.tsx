import { notFound } from 'next/navigation';
import Link from 'next/link';

import { Clock } from 'lucide-react';

import { BookShell } from '../_components/book-shell';
import { loadPublicBookingPage } from '../_lib/server/public-booking.service';

interface Props {
  params: Promise<{ pageSlug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { pageSlug } = await params;
  const loaded = await loadPublicBookingPage(pageSlug);
  if (!loaded) {
    return { title: 'Booking not found' };
  }
  return { title: `${loaded.page.title} · Book` };
}

export default async function PublicBookPage({ params }: Props) {
  const { pageSlug } = await params;
  const loaded = await loadPublicBookingPage(pageSlug);
  if (!loaded) notFound();

  const { page, eventTypes } = loaded;
  const accent = page.brandColour || '#FF5C34';

  return (
    <BookShell
      title={page.title}
      description={page.description}
      brandColour={page.brandColour}
      logoUrl={page.logoUrl}
      hostName={page.hostName}
      hostPictureUrl={page.hostPictureUrl}
    >
      {eventTypes.length === 0 ? (
        <div className="rounded-2xl border border-black/10 bg-white/70 p-8 text-center">
          <p className="font-medium">No meetings are available right now.</p>
          <p className="mt-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
            Please check back later.
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {eventTypes.map((eventType) => (
            <li key={eventType.id}>
              <Link
                href={`/book/${page.slug}/${eventType.slug}`}
                className="block rounded-2xl border border-black/10 bg-white p-5 transition hover:border-[color:var(--hover)]"
                style={
                  {
                    ['--hover' as string]: accent,
                  } as React.CSSProperties
                }
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold">{eventType.name}</h2>
                    {eventType.description ? (
                      <p className="mt-1 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
                        {eventType.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-black/5 px-3 py-1 text-sm">
                    <Clock className="h-3.5 w-3.5" />
                    {eventType.durations.length > 1
                      ? `${eventType.durations.join(' / ')} min`
                      : `${eventType.defaultDuration} min`}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </BookShell>
  );
}
