'use client';

import { useCallback, useEffect, useState } from 'react';

import Link from 'next/link';

import { Calendar, ExternalLink, Video } from 'lucide-react';

import { Button } from '@kit/ui/button';

import pathsConfig from '~/config/paths.config';

import { listClientUpcomingBookingsAction } from '../../scheduling/_lib/server/scheduling-actions';
import type { ClientBookingRow } from '../../scheduling/_lib/server/scheduling.service';

function formatWhen(startAt: string) {
  return new Date(startAt).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ClientUpcomingBookingsBlock({
  accountSlug,
  accountId,
  clientId,
  limit,
  compact = false,
}: {
  accountSlug: string;
  accountId: string;
  clientId: string;
  limit?: number;
  compact?: boolean;
}) {
  const [bookings, setBookings] = useState<ClientBookingRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBookings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await listClientUpcomingBookingsAction({
        accountId,
        clientId,
      });
      setBookings(data ?? []);
    } catch {
      setBookings([]);
    } finally {
      setLoading(false);
    }
  }, [accountId, clientId]);

  useEffect(() => {
    void fetchBookings();
  }, [fetchBookings]);

  const schedulingHref = pathsConfig.app.accountSchedulingBookings.replace(
    '[account]',
    accountSlug,
  );

  const visible =
    typeof limit === 'number' ? bookings.slice(0, limit) : bookings;

  if (compact) {
    if (loading) {
      return (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      );
    }

    if (visible.length === 0) {
      return (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No upcoming bookings.
        </p>
      );
    }

    return (
      <ul className="space-y-2">
        {visible.map((booking) => (
          <li key={booking.id}>
            <div className="rounded-md px-1 py-1">
              <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                {booking.eventTypeName ?? 'Meeting'}
              </p>
              <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                {formatWhen(booking.startAt)}
                {booking.inviteeName ? ` · ${booking.inviteeName}` : ''}
              </p>
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          Upcoming bookings
        </h3>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link href={schedulingHref}>
            All bookings
            <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
          </Link>
        </Button>
      </div>

      {loading ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Loading…
        </p>
      ) : visible.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          No upcoming bookings linked to this client yet. New public bookings
          match automatically when the invitee email matches the client or a
          contact.
        </p>
      ) : (
        <ul className="space-y-2">
          {visible.map((booking) => (
            <li
              key={booking.id}
              className="rounded-md border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-3 py-2.5"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                    {booking.eventTypeName ?? 'Meeting'}
                  </p>
                  <p className="mt-1 flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {formatWhen(booking.startAt)}
                  </p>
                  <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
                    {booking.inviteeName} · {booking.inviteeEmail}
                  </p>
                </div>
                {booking.conferencingUrl ? (
                  <Button type="button" variant="outline" size="sm" asChild>
                    <a
                      href={booking.conferencingUrl}
                      target="_blank"
                      rel="noreferrer"
                    >
                      <Video className="mr-1.5 h-3.5 w-3.5" />
                      Join
                    </a>
                  </Button>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
