import {
  Calendar,
  Camera,
  CircleDot,
  FileText,
  Megaphone,
  MessageSquare,
  RefreshCw,
  Users,
} from 'lucide-react';

import type { CommercialListingEvent } from '~/lib/commercial/listing-events';

const EVENT_ICONS: Record<string, typeof CircleDot> = {
  status_changed: RefreshCw,
  listing_created: CircleDot,
  match_added: Users,
  match_updated: Users,
  viewing_created: Calendar,
  viewing_updated: Calendar,
  enquiry_created: MessageSquare,
  portal_sync: Megaphone,
  media_changed: Camera,
  marketing_updated: FileText,
  note: FileText,
  seeded: CircleDot,
};

function formatWhen(iso: string) {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export function ListingActivityTimeline({
  events,
}: {
  events: CommercialListingEvent[];
}) {
  if (events.length === 0) {
    return (
      <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-6 py-14 text-center">
        <p className="font-medium text-[var(--workspace-shell-text)]">
          No activity yet
        </p>
        <p className="mt-1 text-sm text-[var(--workspace-shell-text-muted)]">
          Status changes, Interest, viewings, enquiries, and portal syncs will
          appear here.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
      <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
        {events.map((event) => {
          const Icon = EVENT_ICONS[event.eventType] ?? CircleDot;
          return (
            <li key={event.id} className="flex gap-3 px-4 py-3.5 sm:px-5">
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--ozer-accent-subtle)] text-[var(--workspace-shell-accent-text)]">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  {event.summary}
                </p>
                <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                  <span className="tracking-wide uppercase">
                    {event.eventType.replace(/_/g, ' ')}
                  </span>
                  <span className="mx-1.5 text-[var(--workspace-shell-text)]/25">
                    ·
                  </span>
                  {formatWhen(event.createdAt)}
                </p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
