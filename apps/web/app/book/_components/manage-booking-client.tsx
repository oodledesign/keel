'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { Loader2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';

import {
  formatBookingWhenForEmail,
  formatInTimezone,
} from '../_lib/calendar-links';
import {
  cancelPublicBookingAction,
  fetchPublicSlotsAction,
  reschedulePublicBookingAction,
} from '../_lib/server/public-booking-actions';
import type { PublicBookingRecord } from '../_lib/server/public-booking.service';

type Slot = { start: string; end: string };

type Props = {
  booking: PublicBookingRecord;
  durations: number[];
};

export function ManageBookingClient({ booking: initial, durations }: Props) {
  const [booking, setBooking] = useState(initial);
  const [mode, setMode] = useState<'view' | 'cancel' | 'reschedule'>('view');
  const [reason, setReason] = useState('');
  const [pending, startTransition] = useTransition();
  const [inviteeTimezone, setInviteeTimezone] = useState(
    initial.inviteeTimezone,
  );
  const [durationMinutes, setDurationMinutes] = useState(durations[0] ?? 30);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);

  const accent = booking.brandColour || '#FF5C34';

  const when = useMemo(
    () => formatBookingWhenForEmail(booking.startAt, booking.inviteeTimezone),
    [booking],
  );

  function loadSlots() {
    setLoadingSlots(true);
    startTransition(async () => {
      try {
        const now = new Date();
        const result = await fetchPublicSlotsAction({
          pageSlug: booking.pageSlug,
          eventSlug: booking.eventSlug,
          durationMinutes,
          inviteeTimezone,
          rangeStartIso: now.toISOString(),
          rangeEndIso: new Date(
            now.getTime() + 14 * 24 * 60 * 60 * 1000,
          ).toISOString(),
          excludeManagementToken: booking.managementToken,
        });
        setSlots(result.slots);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not load slots',
        );
      } finally {
        setLoadingSlots(false);
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      try {
        const updated = await cancelPublicBookingAction({
          managementToken: booking.managementToken,
          cancellationReason: reason || null,
        });
        setBooking(updated);
        setMode('view');
        toast.success('Booking cancelled');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not cancel',
        );
      }
    });
  }

  function reschedule() {
    if (!selectedStart) return;
    startTransition(async () => {
      try {
        const updated = await reschedulePublicBookingAction({
          managementToken: booking.managementToken,
          durationMinutes,
          startAtIso: selectedStart,
          inviteeTimezone,
        });
        setBooking(updated);
        setMode('view');
        setSelectedStart(null);
        toast.success('Booking rescheduled');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not reschedule',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6">
        <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
          {booking.pageTitle}
        </p>
        <h2 className="mt-1 text-2xl font-semibold">{booking.eventTypeName}</h2>
        <p className="mt-3 text-lg font-medium">{when}</p>
        <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
          {booking.status === 'cancelled'
            ? 'Cancelled'
            : booking.status === 'rescheduled'
              ? 'Rescheduled'
              : 'Confirmed'}
        </p>
        {booking.conferencingUrl && booking.status === 'confirmed' ? (
          <p className="mt-4">
            <a
              href={booking.conferencingUrl}
              className="font-medium underline-offset-2 hover:underline"
              style={{ color: accent }}
              target="_blank"
              rel="noreferrer"
            >
              Join meeting
            </a>
          </p>
        ) : null}
        {booking.cancellationReason ? (
          <p className="mt-3 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
            Reason: {booking.cancellationReason}
          </p>
        ) : null}
      </div>

      {booking.status === 'confirmed' && mode === 'view' ? (
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => {
              setMode('reschedule');
              loadSlots();
            }}
          >
            Reschedule
          </Button>
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={() => setMode('cancel')}
          >
            Cancel booking
          </Button>
        </div>
      ) : null}

      {mode === 'cancel' ? (
        <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
          <div className="space-y-2">
            <Label htmlFor="reason">Reason (optional)</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
            />
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setMode('view')}
            >
              Keep booking
            </Button>
            <Button
              type="button"
              className="rounded-full text-white"
              style={{ backgroundColor: accent }}
              disabled={pending}
              onClick={cancel}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm cancellation
            </Button>
          </div>
        </div>
      ) : null}

      {mode === 'reschedule' ? (
        <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
          <div className="flex flex-wrap gap-2">
            {durations.length > 1 ? (
              <Select
                value={String(durationMinutes)}
                onValueChange={(value) => {
                  setDurationMinutes(Number(value));
                  setSelectedStart(null);
                  loadSlots();
                }}
              >
                <SelectTrigger className="w-[140px] rounded-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {durations.map((minutes) => (
                    <SelectItem key={minutes} value={String(minutes)}>
                      {minutes} min
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : null}
            <Select
              value={inviteeTimezone}
              onValueChange={(value) => {
                setInviteeTimezone(value);
                setSelectedStart(null);
              }}
            >
              <SelectTrigger className="w-[200px] rounded-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[inviteeTimezone, 'Europe/London', 'America/New_York', 'UTC']
                  .filter((tz, index, all) => all.indexOf(tz) === index)
                  .map((tz) => (
                    <SelectItem key={tz} value={tz}>
                      {tz}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={loadSlots}
            >
              Refresh times
            </Button>
          </div>

          {loadingSlots ? (
            <p className="flex items-center gap-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading open times…
            </p>
          ) : (
            <div className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-3">
              {slots.map((slot) => (
                <button
                  key={slot.start}
                  type="button"
                  className={`rounded-full border px-3 py-2 text-sm ${
                    selectedStart === slot.start
                      ? 'border-transparent text-white'
                      : 'border-black/10'
                  }`}
                  style={
                    selectedStart === slot.start
                      ? { backgroundColor: accent }
                      : undefined
                  }
                  onClick={() => setSelectedStart(slot.start)}
                >
                  {formatInTimezone(slot.start, inviteeTimezone, {
                    weekday: 'short',
                    day: 'numeric',
                    month: 'short',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </button>
              ))}
              {slots.length === 0 ? (
                <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
                  No open times in the next fortnight.
                </p>
              ) : null}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => setMode('view')}
            >
              Back
            </Button>
            <Button
              type="button"
              className="rounded-full text-white"
              style={{ backgroundColor: accent }}
              disabled={pending || !selectedStart}
              onClick={reschedule}
            >
              {pending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Confirm new time
            </Button>
          </div>
        </div>
      ) : null}

      <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
        <Link
          href={`/book/${booking.pageSlug}`}
          className="underline-offset-2 hover:underline"
        >
          Back to booking page
        </Link>
      </p>
    </div>
  );
}
