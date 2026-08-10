'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Button } from '@kit/ui/button';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
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

import {
  workspaceBtnPrimaryMd,
  workspaceTextMuted,
} from '~/lib/workspace-ui';

import {
  createHostBookingAction,
  getHostBusyIntervalsAction,
  listCreateMeetingOptionsAction,
} from '../_lib/server/scheduling-actions';
import {
  CreateMeetingWeekGrid,
  type HostBusyInterval,
  addDaysYmd,
  startOfWeekMonday,
  weekRangeIso,
} from './create-meeting-week-grid';

export type CreateMeetingPrefill = {
  clientId?: string | null;
  inviteeName?: string | null;
  inviteeEmail?: string | null;
};

type MeetingPageOption = {
  pageId: string;
  pageSlug: string;
  pageTitle: string;
  timezone: string;
  hostUserId: string | null;
  eventTypes: Array<{
    id: string;
    slug: string;
    name: string;
    durations: number[];
    defaultDuration: number;
    locationType: string;
  }>;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  prefill?: CreateMeetingPrefill;
  onCreated?: () => void;
};

function pad2(value: number) {
  return String(value).padStart(2, '0');
}

function defaultLocalDateTime() {
  const now = new Date();
  const minutes = now.getMinutes();
  const add = minutes === 0 ? 0 : 30 - (minutes % 30);
  now.setMinutes(minutes + add, 0, 0);
  if (add === 0) {
    now.setHours(now.getHours() + 1);
  }
  return {
    date: `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`,
    time: `${pad2(now.getHours())}:${pad2(now.getMinutes())}`,
  };
}

function toOffsetIso(dateYmd: string, timeHm: string) {
  const local = new Date(`${dateYmd}T${timeHm}:00`);
  if (Number.isNaN(local.getTime())) {
    throw new Error('Invalid date or time');
  }
  return local.toISOString();
}

function browserTimezone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

export function CreateMeetingDialog({
  open,
  onOpenChange,
  accountId,
  accountSlug,
  prefill,
  onCreated,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [pages, setPages] = useState<MeetingPageOption[]>([]);
  const [pageSlug, setPageSlug] = useState('');
  const [eventSlug, setEventSlug] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(30);
  const defaults = useMemo(() => defaultLocalDateTime(), [open]);
  const [dateYmd, setDateYmd] = useState(defaults.date);
  const [timeHm, setTimeHm] = useState(defaults.time);
  const [weekStartYmd, setWeekStartYmd] = useState(() =>
    startOfWeekMonday(defaults.date),
  );
  const [inviteeName, setInviteeName] = useState('');
  const [inviteeEmail, setInviteeEmail] = useState('');
  const [inviteeNotes, setInviteeNotes] = useState('');
  const [notifyInvitee, setNotifyInvitee] = useState(true);
  const [busy, setBusy] = useState<HostBusyInterval[]>([]);
  const [loadingBusy, setLoadingBusy] = useState(false);

  const selectedPage = pages.find((page) => page.pageSlug === pageSlug);
  const selectedEvent = selectedPage?.eventTypes.find(
    (event) => event.slug === eventSlug,
  );

  useEffect(() => {
    if (!open) return;

    const nextDefaults = defaultLocalDateTime();
    setDateYmd(nextDefaults.date);
    setTimeHm(nextDefaults.time);
    setWeekStartYmd(startOfWeekMonday(nextDefaults.date));
    setInviteeName(prefill?.inviteeName?.trim() || '');
    setInviteeEmail(prefill?.inviteeEmail?.trim() || '');
    setInviteeNotes('');
    setNotifyInvitee(true);
    setBusy([]);
    setLoadingOptions(true);

    void listCreateMeetingOptionsAction({ accountId })
      .then((options) => {
        setPages(options);
        const firstPage = options[0];
        const firstEvent = firstPage?.eventTypes[0];
        setPageSlug(firstPage?.pageSlug ?? '');
        setEventSlug(firstEvent?.slug ?? '');
        setDurationMinutes(
          firstEvent?.defaultDuration ?? firstEvent?.durations[0] ?? 30,
        );
      })
      .catch((error) => {
        setPages([]);
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not load scheduling options',
        );
      })
      .finally(() => setLoadingOptions(false));
  }, [open, accountId, prefill?.inviteeName, prefill?.inviteeEmail]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (!selectedEvent.durations.includes(durationMinutes)) {
      setDurationMinutes(
        selectedEvent.defaultDuration ?? selectedEvent.durations[0] ?? 30,
      );
    }
  }, [selectedEvent, durationMinutes]);

  useEffect(() => {
    if (!open || !accountId) return;

    const { fromIso, toIso } = weekRangeIso(weekStartYmd);
    let cancelled = false;
    setLoadingBusy(true);

    void getHostBusyIntervalsAction({
      accountId,
      accountSlug,
      fromIso,
      toIso,
      hostUserId: selectedPage?.hostUserId ?? undefined,
      timeZone: browserTimezone(),
    })
      .then((result) => {
        if (!cancelled) {
          setBusy(result.intervals ?? []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBusy([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingBusy(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [
    open,
    accountId,
    accountSlug,
    weekStartYmd,
    selectedPage?.hostUserId,
  ]);

  function onPageChange(nextPageSlug: string) {
    setPageSlug(nextPageSlug);
    const page = pages.find((item) => item.pageSlug === nextPageSlug);
    const event = page?.eventTypes[0];
    setEventSlug(event?.slug ?? '');
    setDurationMinutes(event?.defaultDuration ?? event?.durations[0] ?? 30);
  }

  function onEventChange(nextEventSlug: string) {
    setEventSlug(nextEventSlug);
    const event = selectedPage?.eventTypes.find(
      (item) => item.slug === nextEventSlug,
    );
    setDurationMinutes(event?.defaultDuration ?? event?.durations[0] ?? 30);
  }

  function onDateInputChange(nextDate: string) {
    setDateYmd(nextDate);
    setWeekStartYmd(startOfWeekMonday(nextDate));
  }

  function onSelectSlot(nextDate: string, nextTime: string) {
    setDateYmd(nextDate);
    setTimeHm(nextTime);
    setWeekStartYmd(startOfWeekMonday(nextDate));
  }

  function onWeekChange(nextWeekStart: string) {
    setWeekStartYmd(nextWeekStart);
    if (
      dateYmd < nextWeekStart ||
      dateYmd > addDaysYmd(nextWeekStart, 6)
    ) {
      setDateYmd(nextWeekStart);
    }
  }

  function submit() {
    if (!pageSlug || !eventSlug) {
      toast.error('Choose a booking page and event type');
      return;
    }
    if (!inviteeName.trim() || !inviteeEmail.trim()) {
      toast.error('Invitee name and email are required');
      return;
    }

    startTransition(async () => {
      try {
        const startAtIso = toOffsetIso(dateYmd, timeHm);
        await createHostBookingAction({
          accountId,
          accountSlug,
          pageSlug,
          eventSlug,
          durationMinutes,
          startAtIso,
          inviteeName: inviteeName.trim(),
          inviteeEmail: inviteeEmail.trim(),
          inviteeTimezone: browserTimezone(),
          inviteeNotes: inviteeNotes.trim() || null,
          clientId: prefill?.clientId ?? null,
          notifyInvitee,
        });
        toast.success(
          notifyInvitee
            ? 'Meeting created and invitee notified'
            : 'Meeting created',
        );
        onOpenChange(false);
        onCreated?.();
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not create meeting';
        toast.error(
          /duplicate|unique|just booked/i.test(message)
            ? 'That exact start time is already booked for this event type. Pick another time.'
            : message,
        );
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Create meeting</DialogTitle>
        </DialogHeader>

        {loadingOptions ? (
          <p className={`text-sm ${workspaceTextMuted}`}>Loading options…</p>
        ) : pages.length === 0 ? (
          <p className={`text-sm ${workspaceTextMuted}`}>
            Add an active booking page with at least one active event type in
            Scheduling before creating meetings here.
          </p>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Booking page</Label>
                <Select value={pageSlug} onValueChange={onPageChange}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select page" />
                  </SelectTrigger>
                  <SelectContent>
                    {pages.map((page) => (
                      <SelectItem key={page.pageId} value={page.pageSlug}>
                        {page.pageTitle}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Event type</Label>
                <Select
                  value={eventSlug}
                  onValueChange={onEventChange}
                  disabled={!selectedPage}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select event" />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedPage?.eventTypes ?? []).map((event) => (
                      <SelectItem key={event.id} value={event.slug}>
                        {event.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-meeting-duration">Duration</Label>
                <Select
                  value={String(durationMinutes)}
                  onValueChange={(value) => setDurationMinutes(Number(value))}
                  disabled={!selectedEvent}
                >
                  <SelectTrigger id="create-meeting-duration">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(selectedEvent?.durations ?? [durationMinutes]).map(
                      (duration) => (
                        <SelectItem key={duration} value={String(duration)}>
                          {duration} min
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="create-meeting-date">Date</Label>
                  <Input
                    id="create-meeting-date"
                    type="date"
                    value={dateYmd}
                    onChange={(event) => onDateInputChange(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-meeting-time">Start time</Label>
                  <Input
                    id="create-meeting-time"
                    type="time"
                    value={timeHm}
                    onChange={(event) => setTimeHm(event.target.value)}
                    step={900}
                  />
                </div>
              </div>
            </div>

            <CreateMeetingWeekGrid
              weekStartYmd={weekStartYmd}
              selectedDateYmd={dateYmd}
              selectedTimeHm={timeHm}
              durationMinutes={durationMinutes}
              busy={busy}
              loading={loadingBusy}
              onWeekChange={onWeekChange}
              onSelectSlot={onSelectSlot}
            />

            <p className={`text-xs ${workspaceTextMuted}`}>
              Uses your local timezone ({browserTimezone()}). Availability rules
              are not enforced — you can still book over busy times.
            </p>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="create-meeting-name">Invitee name</Label>
                <Input
                  id="create-meeting-name"
                  value={inviteeName}
                  onChange={(event) => setInviteeName(event.target.value)}
                  autoComplete="name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="create-meeting-email">Invitee email</Label>
                <Input
                  id="create-meeting-email"
                  type="email"
                  value={inviteeEmail}
                  onChange={(event) => setInviteeEmail(event.target.value)}
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="create-meeting-notes">Notes (optional)</Label>
                <Textarea
                  id="create-meeting-notes"
                  value={inviteeNotes}
                  onChange={(event) => setInviteeNotes(event.target.value)}
                  rows={3}
                />
              </div>

              <label className="flex items-start gap-2 sm:col-span-2">
                <Checkbox
                  checked={notifyInvitee}
                  onCheckedChange={(value) => setNotifyInvitee(value === true)}
                  className="mt-0.5"
                />
                <span className="text-sm">
                  Notify invitee
                  <span className={`mt-0.5 block text-xs ${workspaceTextMuted}`}>
                    Sends confirmation email and calendar invite notifications.
                  </span>
                </span>
              </label>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={pending || loadingOptions || pages.length === 0}
            onClick={submit}
          >
            {pending ? 'Creating…' : 'Create meeting'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
