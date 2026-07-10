'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowLeft,
  CalendarPlus,
  Check,
  Download,
  Loader2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { Textarea } from '@kit/ui/textarea';
import { toast } from '@kit/ui/sonner';

import {
  buildBookingIcs,
  formatBookingWhenForEmail,
  formatInTimezone,
  googleCalendarTemplateUrl,
} from '../_lib/calendar-links';
import {
  createPublicBookingAction,
  fetchPublicSlotsAction,
} from '../_lib/server/public-booking-actions';
import type {
  PublicBookingRecord,
  PublicEventType,
  PublicFormField,
  PublicBookingPage,
} from '../_lib/server/public-booking.service';

const TIMEZONES = [
  'Europe/London',
  'Europe/Paris',
  'Europe/Dublin',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Dubai',
  'Asia/Singapore',
  'Australia/Sydney',
  'UTC',
];

type Slot = { start: string; end: string };

type Props = {
  page: PublicBookingPage;
  eventType: PublicEventType;
  formFields: PublicFormField[];
};

type Step = 'slots' | 'details' | 'confirmed';

function startOfWeek(date: Date, timeZone: string) {
  // Approximate week start (Monday) using locale parts in invitee TZ
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
  }).formatToParts(date);

  const y = Number(parts.find((p) => p.type === 'year')?.value);
  const m = Number(parts.find((p) => p.type === 'month')?.value);
  const d = Number(parts.find((p) => p.type === 'day')?.value);
  const weekday = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const map: Record<string, number> = {
    Mon: 0,
    Tue: 1,
    Wed: 2,
    Thu: 3,
    Fri: 4,
    Sat: 5,
    Sun: 6,
  };
  const offset = map[weekday] ?? 0;
  const utcGuess = Date.UTC(y, m - 1, d - offset, 12, 0, 0);
  return new Date(utcGuess);
}

function addDays(date: Date, days: number) {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function ymdInTz(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

export function BookingWizard({ page, eventType, formFields }: Props) {
  const router = useRouter();
  const accent = page.brandColour || '#FF5C34';
  const [step, setStep] = useState<Step>('slots');
  const [pending, startTransition] = useTransition();

  const [inviteeTimezone, setInviteeTimezone] = useState('Europe/London');
  const [durationMinutes, setDurationMinutes] = useState(
    eventType.defaultDuration,
  );
  const [weekAnchor, setWeekAnchor] = useState(() => new Date());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [guestInput, setGuestInput] = useState('');
  const [guests, setGuests] = useState<string[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [booking, setBooking] = useState<PublicBookingRecord | null>(null);

  useEffect(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (detected) setInviteeTimezone(detected);
    } catch {
      // keep default
    }
  }, []);

  const weekStart = useMemo(
    () => startOfWeek(weekAnchor, inviteeTimezone),
    [weekAnchor, inviteeTimezone],
  );

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const windowEnd = useMemo(
    () =>
      new Date(
        Date.now() + eventType.bookingWindowDays * 24 * 60 * 60 * 1000,
      ),
    [eventType.bookingWindowDays],
  );

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);

    const rangeStart = weekStart;
    const rangeEnd = addDays(weekStart, 7);

    startTransition(async () => {
      try {
        const result = await fetchPublicSlotsAction({
          pageSlug: page.slug,
          eventSlug: eventType.slug,
          durationMinutes,
          inviteeTimezone,
          rangeStartIso: rangeStart.toISOString(),
          rangeEndIso: rangeEnd.toISOString(),
        });
        if (!cancelled) {
          setSlots(result.slots);
        }
      } catch (error) {
        if (!cancelled) {
          setSlots([]);
          toast.error(
            error instanceof Error ? error.message : 'Could not load slots',
          );
        }
      } finally {
        if (!cancelled) setLoadingSlots(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [
    page.slug,
    eventType.slug,
    durationMinutes,
    inviteeTimezone,
    weekStart,
  ]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const day of days) {
      map.set(ymdInTz(day, inviteeTimezone), []);
    }
    for (const slot of slots) {
      const key = ymdInTz(new Date(slot.start), inviteeTimezone);
      const list = map.get(key);
      if (list) list.push(slot);
    }
    return map;
  }, [slots, days, inviteeTimezone]);

  function addGuest() {
    const next = guestInput.trim().toLowerCase();
    if (!next) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(next)) {
      toast.error('Enter a valid guest email');
      return;
    }
    if (guests.includes(next)) {
      setGuestInput('');
      return;
    }
    if (guests.length >= 10) {
      toast.error('You can add up to 10 guests');
      return;
    }
    setGuests((current) => [...current, next]);
    setGuestInput('');
  }

  function submitBooking() {
    if (!selectedStart) return;

    startTransition(async () => {
      try {
        const created = await createPublicBookingAction({
          pageSlug: page.slug,
          eventSlug: eventType.slug,
          durationMinutes,
          startAtIso: selectedStart,
          inviteeName: name.trim(),
          inviteeEmail: email.trim(),
          inviteeTimezone,
          guests: guests.map((guestEmail) => ({ email: guestEmail })),
          formResponses: formFields.map((field) => ({
            formFieldId: field.id,
            value: answers[field.id] ?? null,
          })),
        });
        setBooking(created);
        setStep('confirmed');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not complete booking',
        );
        setStep('slots');
        setSelectedStart(null);
      }
    });
  }

  if (step === 'confirmed' && booking) {
    return (
      <ConfirmationView
        booking={booking}
        accent={accent}
        onDone={() => router.push(`/book/${page.slug}`)}
      />
    );
  }

  if (step === 'details' && selectedStart) {
    return (
      <div className="space-y-6">
        <button
          type="button"
          className="inline-flex items-center gap-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)] hover:text-inherit"
          onClick={() => setStep('slots')}
        >
          <ArrowLeft className="h-4 w-4" />
          Back to times
        </button>

        <div className="rounded-2xl border border-black/10 bg-white p-5">
          <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
            Selected time
          </p>
          <p className="mt-1 text-lg font-semibold">
            {formatInTimezone(selectedStart, inviteeTimezone, {
              weekday: 'long',
              day: 'numeric',
              month: 'long',
              hour: '2-digit',
              minute: '2-digit',
            })}{' '}
            · {durationMinutes} min
          </p>
          <p className="text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
            Shown in {inviteeTimezone}
          </p>
        </div>

        <div className="space-y-4 rounded-2xl border border-black/10 bg-white p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="invitee-name">Name</Label>
              <Input
                id="invitee-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="invitee-email">Email</Label>
              <Input
                id="invitee-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          {formFields.map((field) => (
            <FormFieldControl
              key={field.id}
              field={field}
              value={answers[field.id]}
              onChange={(value) =>
                setAnswers((current) => ({ ...current, [field.id]: value }))
              }
            />
          ))}

          {eventType.allowGuestInvites ? (
            <div className="space-y-2">
              <Label>Add guests</Label>
              <div className="flex gap-2">
                <Input
                  type="email"
                  placeholder="colleague@company.com"
                  value={guestInput}
                  onChange={(e) => setGuestInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addGuest();
                    }
                  }}
                />
                <Button type="button" variant="outline" onClick={addGuest}>
                  Add
                </Button>
              </div>
              {guests.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {guests.map((guest) => (
                    <span
                      key={guest}
                      className="inline-flex items-center gap-1 rounded-full bg-black/5 px-3 py-1 text-sm"
                    >
                      {guest}
                      <button
                        type="button"
                        onClick={() =>
                          setGuests((current) =>
                            current.filter((item) => item !== guest),
                          )
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          <Button
            type="button"
            className="h-11 w-full rounded-full text-white"
            style={{ backgroundColor: accent }}
            disabled={pending || !name.trim() || !email.trim()}
            onClick={submitBooking}
          >
            {pending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Booking…
              </>
            ) : (
              'Confirm booking'
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <Link
            href={`/book/${page.slug}`}
            className="inline-flex items-center gap-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)] hover:text-inherit"
          >
            <ArrowLeft className="h-4 w-4" />
            All meeting types
          </Link>
          <h2 className="mt-2 text-2xl font-semibold">{eventType.name}</h2>
          {eventType.description ? (
            <p className="mt-1 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
              {eventType.description}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap gap-2">
          {eventType.durations.length > 1 ? (
            <Select
              value={String(durationMinutes)}
              onValueChange={(value) => {
                setDurationMinutes(Number(value));
                setSelectedStart(null);
              }}
            >
              <SelectTrigger className="w-[140px] rounded-full bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {eventType.durations.map((minutes) => (
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
            <SelectTrigger className="w-[200px] rounded-full bg-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[inviteeTimezone, ...TIMEZONES.filter((tz) => tz !== inviteeTimezone)].map(
                (tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ),
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={weekStart.getTime() <= Date.now() - 7 * 24 * 60 * 60 * 1000}
          onClick={() => setWeekAnchor(addDays(weekStart, -7))}
        >
          Previous
        </Button>
        <p className="text-sm font-medium">
          {formatInTimezone(weekStart.toISOString(), inviteeTimezone, {
            day: 'numeric',
            month: 'short',
          })}{' '}
          –{' '}
          {formatInTimezone(
            addDays(weekStart, 6).toISOString(),
            inviteeTimezone,
            { day: 'numeric', month: 'short', year: 'numeric' },
          )}
        </p>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          disabled={addDays(weekStart, 7) > windowEnd}
          onClick={() => setWeekAnchor(addDays(weekStart, 7))}
        >
          Next
        </Button>
      </div>

      {loadingSlots ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-black/10 bg-white p-12 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding open times…
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-7">
          {days.map((day) => {
            const key = ymdInTz(day, inviteeTimezone);
            const daySlots = slotsByDay.get(key) ?? [];
            return (
              <div
                key={key}
                className="rounded-2xl border border-black/10 bg-white p-3"
              >
                <p className="text-center text-xs font-semibold uppercase tracking-wide text-[color:var(--ozer-text-muted,#6B5B63)]">
                  {formatInTimezone(day.toISOString(), inviteeTimezone, {
                    weekday: 'short',
                  })}
                </p>
                <p className="mb-3 text-center text-sm font-medium">
                  {formatInTimezone(day.toISOString(), inviteeTimezone, {
                    day: 'numeric',
                    month: 'short',
                  })}
                </p>
                <div className="space-y-1.5">
                  {daySlots.length === 0 ? (
                    <p className="py-4 text-center text-xs text-[color:var(--ozer-text-muted,#6B5B63)]">
                      —
                    </p>
                  ) : (
                    daySlots.map((slot) => {
                      const selected = selectedStart === slot.start;
                      return (
                        <button
                          key={slot.start}
                          type="button"
                          className={`w-full rounded-full border px-2 py-1.5 text-xs font-medium transition ${
                            selected
                              ? 'border-transparent text-white'
                              : 'border-black/10 hover:border-black/30'
                          }`}
                          style={
                            selected ? { backgroundColor: accent } : undefined
                          }
                          onClick={() => setSelectedStart(slot.start)}
                        >
                          {formatInTimezone(slot.start, inviteeTimezone, {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex justify-end">
        <Button
          type="button"
          className="h-11 rounded-full px-6 text-white"
          style={{ backgroundColor: accent }}
          disabled={!selectedStart}
          onClick={() => setStep('details')}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

function FormFieldControl({
  field,
  value,
  onChange,
}: {
  field: PublicFormField;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  if (field.fieldType === 'textarea') {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.isRequired ? ' *' : ''}
        </Label>
        <Textarea
          value={typeof value === 'string' ? value : ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.isRequired}
        />
      </div>
    );
  }

  if (field.fieldType === 'checkbox') {
    return (
      <div className="flex items-center gap-2">
        <Checkbox
          checked={value === true}
          onCheckedChange={(checked) => onChange(checked === true)}
        />
        <Label>
          {field.label}
          {field.isRequired ? ' *' : ''}
        </Label>
      </div>
    );
  }

  if (field.fieldType === 'select' && field.options) {
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.isRequired ? ' *' : ''}
        </Label>
        <Select
          value={typeof value === 'string' ? value : undefined}
          onValueChange={onChange}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select…" />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  if (field.fieldType === 'multiselect' && field.options) {
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <div className="space-y-2">
        <Label>
          {field.label}
          {field.isRequired ? ' *' : ''}
        </Label>
        <div className="space-y-2">
          {field.options.map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={(checked) => {
                  onChange(
                    checked
                      ? [...selected, option]
                      : selected.filter((item) => item !== option),
                  );
                }}
              />
              {option}
            </label>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <Label>
        {field.label}
        {field.isRequired ? ' *' : ''}
      </Label>
      <Input
        type={
          field.fieldType === 'phone'
            ? 'tel'
            : field.fieldType === 'url'
              ? 'url'
              : 'text'
        }
        value={typeof value === 'string' ? value : ''}
        onChange={(e) => onChange(e.target.value)}
        required={field.isRequired}
      />
    </div>
  );
}

function ConfirmationView({
  booking,
  accent,
  onDone,
}: {
  booking: PublicBookingRecord;
  accent: string;
  onDone: () => void;
}) {
  const when = formatBookingWhenForEmail(
    booking.startAt,
    booking.inviteeTimezone,
  );

  const ics = buildBookingIcs({
    title: booking.eventTypeName,
    description: `Meeting with ${booking.pageTitle}`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: booking.conferencingUrl ?? booking.locationDetail,
    url: booking.conferencingUrl,
    uid: `booking-${booking.id}@ozer.so`,
    attendeeEmail: booking.inviteeEmail,
    attendeeName: booking.inviteeName,
  });

  const googleUrl = googleCalendarTemplateUrl({
    title: booking.eventTypeName,
    details: `Booked via ${booking.pageTitle}`,
    startAt: booking.startAt,
    endAt: booking.endAt,
    location: booking.conferencingUrl ?? booking.locationDetail,
  });

  function downloadIcs() {
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'booking.ics';
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-black/10 bg-white p-6 text-center">
        <div
          className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-white"
          style={{ backgroundColor: accent }}
        >
          <Check className="h-6 w-6" />
        </div>
        <h2 className="text-2xl font-semibold">You&apos;re booked</h2>
        <p className="mt-2 text-[color:var(--ozer-text-muted,#6B5B63)]">
          {booking.eventTypeName}
        </p>
        <p className="mt-4 text-lg font-medium">{when}</p>
        {booking.conferencingUrl ? (
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
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          asChild
        >
          <a href={googleUrl} target="_blank" rel="noreferrer">
            <CalendarPlus className="mr-2 h-4 w-4" />
            Google Calendar
          </a>
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          onClick={downloadIcs}
        >
          <Download className="mr-2 h-4 w-4" />
          Download .ics
        </Button>
        <Button
          type="button"
          variant="outline"
          className="rounded-full"
          asChild
        >
          <Link href={`/book/manage/${booking.managementToken}`}>
            Manage booking
          </Link>
        </Button>
      </div>

      <div className="text-center">
        <Button
          type="button"
          className="rounded-full text-white"
          style={{ backgroundColor: accent }}
          onClick={onDone}
        >
          Done
        </Button>
      </div>
    </div>
  );
}
