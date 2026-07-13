'use client';

import {
  type ComponentProps,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from 'react';

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
import { Calendar, CalendarDayButton } from '@kit/ui/calendar';
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
import { toast } from '@kit/ui/sonner';
import { Textarea } from '@kit/ui/textarea';
import { cn } from '@kit/ui/utils';

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
  PublicBookingPage,
  PublicBookingRecord,
  PublicEventType,
  PublicFormField,
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

function ymdInTz(date: Date, timeZone: string) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function ymdLocal(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function monthFetchRange(month: Date, bookingWindowDays: number) {
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
  const monthEnd = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0,
    23,
    59,
    59,
    999,
  );
  const now = new Date();
  const windowEnd = new Date(
    now.getTime() + bookingWindowDays * 24 * 60 * 60 * 1000,
  );
  const rangeStart = monthStart < now ? now : monthStart;
  const rangeEnd = monthEnd > windowEnd ? windowEnd : monthEnd;
  return { rangeStart, rangeEnd, windowEnd };
}

function AvailabilityDayButton({
  className,
  modifiers,
  ...props
}: ComponentProps<typeof CalendarDayButton>) {
  return (
    <CalendarDayButton
      className={cn(
        className,
        'relative pb-2 text-[color:var(--ozer-plum-950,#2A1720)]',
        'hover:bg-black/[0.06] hover:text-[color:var(--ozer-plum-950,#2A1720)]',
        'data-[selected-single=true]:bg-[color-mix(in_srgb,var(--book-accent,#FF5C34)_18%,white)]',
        'data-[selected-single=true]:text-[color:var(--ozer-plum-950,#2A1720)]',
        'data-[selected-single=true]:hover:bg-[color-mix(in_srgb,var(--book-accent,#FF5C34)_24%,white)]',
        'data-[selected-single=true]:font-semibold',
      )}
      modifiers={modifiers}
      {...props}
    >
      {props.children}
      {modifiers.available ? (
        <span
          aria-hidden
          className="absolute bottom-1 left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-emerald-500"
        />
      ) : null}
    </CalendarDayButton>
  );
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
  const [month, setMonth] = useState(() => startOfLocalDay(new Date()));
  const [selectedDay, setSelectedDay] = useState<Date | undefined>(undefined);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedStart, setSelectedStart] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [guestsOpen, setGuestsOpen] = useState(false);
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

  const monthRange = useMemo(
    () => monthFetchRange(month, eventType.bookingWindowDays),
    [month, eventType.bookingWindowDays],
  );
  const { windowEnd } = monthRange;

  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);

    const { rangeStart, rangeEnd } = monthRange;

    if (rangeStart > rangeEnd) {
      setSlots([]);
      setLoadingSlots(false);
      return;
    }

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
    monthRange,
  ]);

  const slotsByDay = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const slot of slots) {
      const key = ymdInTz(new Date(slot.start), inviteeTimezone);
      const list = map.get(key) ?? [];
      list.push(slot);
      map.set(key, list);
    }
    return map;
  }, [slots, inviteeTimezone]);

  const availableDays = useMemo(() => {
    return Array.from(slotsByDay.entries())
      .filter(([, daySlots]) => daySlots.length > 0)
      .map(([key]) => {
        const [year, monthNum, day] = key.split('-').map(Number);
        return new Date(year!, monthNum! - 1, day!);
      });
  }, [slotsByDay]);

  const availableDayKeys = useMemo(
    () => new Set(slotsByDay.keys()),
    [slotsByDay],
  );

  useEffect(() => {
    if (loadingSlots) return;

    const selectedKey = selectedDay ? ymdLocal(selectedDay) : null;
    if (selectedKey && availableDayKeys.has(selectedKey)) return;

    const first = availableDays[0];
    if (first) {
      setSelectedDay(first);
      setSelectedStart(null);
      return;
    }

    setSelectedDay(undefined);
    setSelectedStart(null);
  }, [loadingSlots, availableDays, availableDayKeys, selectedDay]);

  const selectedDayKey = selectedDay ? ymdLocal(selectedDay) : null;
  const daySlots = selectedDayKey ? (slotsByDay.get(selectedDayKey) ?? []) : [];

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
          inviteeNotes: notes.trim() || null,
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

          <div className="space-y-2">
            <Label htmlFor="invitee-notes">Notes</Label>
            <Textarea
              id="invitee-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Anything the host should know before the meeting?"
              rows={3}
            />
          </div>

          {eventType.allowGuestInvites ? (
            <div className="space-y-2 rounded-xl border border-black/10 p-3">
              <button
                type="button"
                className="flex w-full items-center justify-between text-left text-sm font-medium"
                onClick={() => setGuestsOpen((open) => !open)}
                aria-expanded={guestsOpen}
              >
                <span>
                  Add guests
                  {guests.length > 0 ? (
                    <span className="text-muted-foreground ml-2 font-normal">
                      ({guests.length})
                    </span>
                  ) : null}
                </span>
                <span className="text-muted-foreground text-xs">
                  {guestsOpen ? 'Hide' : 'Show'}
                </span>
              </button>

              {guestsOpen ? (
                <div className="space-y-2 pt-1">
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

  const today = startOfLocalDay(new Date());

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          {!eventType.isPrivate ? (
            <Link
              href={`/book/${page.slug}`}
              className="inline-flex items-center gap-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)] hover:text-inherit"
            >
              <ArrowLeft className="h-4 w-4" />
              All meeting types
            </Link>
          ) : null}
          <h2
            className={`text-2xl font-semibold ${eventType.isPrivate ? '' : 'mt-2'}`}
          >
            {eventType.name}
          </h2>
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
              {[
                inviteeTimezone,
                ...TIMEZONES.filter((tz) => tz !== inviteeTimezone),
              ].map((tz) => (
                <SelectItem key={tz} value={tz}>
                  {tz}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div
        className="grid gap-4 rounded-2xl border border-black/10 bg-white p-4 md:grid-cols-[minmax(0,1fr)_minmax(220px,280px)] md:p-5"
        style={{ ['--book-accent' as string]: accent }}
      >
        <div className="flex flex-col items-center">
          <Calendar
            mode="single"
            month={month}
            onMonthChange={(next) => {
              setMonth(startOfLocalDay(next));
              setSelectedStart(null);
            }}
            selected={selectedDay}
            onSelect={(date) => {
              if (!date) return;
              setSelectedDay(startOfLocalDay(date));
              setSelectedStart(null);
            }}
            disabled={(date) => {
              const key = ymdLocal(date);
              if (startOfLocalDay(date) < today) return true;
              if (date > windowEnd) return true;
              if (loadingSlots) return true;
              return !availableDayKeys.has(key);
            }}
            modifiers={{ available: availableDays }}
            modifiersClassNames={{
              available: 'font-medium',
            }}
            components={{
              DayButton: AvailabilityDayButton,
            }}
            className="w-full bg-transparent p-0 [--cell-size:2.75rem]"
          />
          {loadingSlots ? (
            <p className="mt-3 flex items-center gap-2 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Finding open days…
            </p>
          ) : null}
        </div>

        <div className="flex min-h-[280px] flex-col border-t border-black/10 pt-4 md:border-t-0 md:border-l md:pt-0 md:pl-5">
          <p className="text-sm font-semibold">
            {selectedDay
              ? selectedDay.toLocaleDateString(undefined, {
                  weekday: 'long',
                  day: 'numeric',
                  month: 'long',
                })
              : 'Select a day'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--ozer-text-muted,#6B5B63)]">
            Times shown in {inviteeTimezone}
          </p>

          <div className="mt-4 flex-1 space-y-2 overflow-y-auto pr-1">
            {loadingSlots ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading times…
              </div>
            ) : !selectedDay ? (
              <p className="py-10 text-center text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
                Choose an available day on the calendar.
              </p>
            ) : daySlots.length === 0 ? (
              <p className="py-10 text-center text-sm text-[color:var(--ozer-text-muted,#6B5B63)]">
                No times left on this day.
              </p>
            ) : (
              daySlots.map((slot) => {
                const selected = selectedStart === slot.start;
                return (
                  <button
                    key={slot.start}
                    type="button"
                    className={`w-full rounded-full border px-3 py-2.5 text-sm font-medium transition ${
                      selected
                        ? 'border-transparent text-white'
                        : 'border-black/10 hover:border-black/30'
                    }`}
                    style={selected ? { backgroundColor: accent } : undefined}
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
      </div>

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
