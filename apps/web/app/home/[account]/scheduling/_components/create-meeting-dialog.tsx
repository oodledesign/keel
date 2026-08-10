'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Plus, X } from 'lucide-react';

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
  listClients,
  listContacts,
} from '~/home/[account]/clients/_lib/server/server-actions';
import { ClientCombobox } from '~/home/[account]/projects/_components/client-combobox';
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

type AttendeeDraft = {
  key: string;
  name: string;
  email: string;
  contactId?: string | null;
};

type ClientContactOption = {
  id: string;
  full_name: string;
  email: string | null;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountId: string;
  accountSlug: string;
  prefill?: CreateMeetingPrefill;
  onCreated?: () => void;
};

const MAX_ATTENDEES = 11;

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

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function makeAttendeeKey() {
  return `attendee-${Math.random().toString(36).slice(2, 10)}`;
}

function attendeesFromPrefill(prefill?: CreateMeetingPrefill): AttendeeDraft[] {
  const email = prefill?.inviteeEmail?.trim() || '';
  const name = prefill?.inviteeName?.trim() || '';
  if (!email && !name) return [];
  return [
    {
      key: makeAttendeeKey(),
      name,
      email,
      contactId: null,
    },
  ];
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
  const [clientId, setClientId] = useState('');
  const [clients, setClients] = useState<
    Array<{
      id: string;
      display_name: string | null;
      company_name?: string | null;
    }>
  >([]);
  const [clientsLoading, setClientsLoading] = useState(false);
  const [contacts, setContacts] = useState<ClientContactOption[]>([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [attendees, setAttendees] = useState<AttendeeDraft[]>([]);
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [contactToAdd, setContactToAdd] = useState('');
  const [inviteeNotes, setInviteeNotes] = useState('');
  const [notifyInvitee, setNotifyInvitee] = useState(true);
  const [busy, setBusy] = useState<HostBusyInterval[]>([]);
  const [loadingBusy, setLoadingBusy] = useState(false);

  const selectedPage = pages.find((page) => page.pageSlug === pageSlug);
  const selectedEvent = selectedPage?.eventTypes.find(
    (event) => event.slug === eventSlug,
  );

  const availableContacts = useMemo(() => {
    const takenEmails = new Set(
      attendees.map((item) => item.email.trim().toLowerCase()).filter(Boolean),
    );
    const takenIds = new Set(
      attendees.map((item) => item.contactId).filter(Boolean),
    );
    return contacts.filter((contact) => {
      const email = contact.email?.trim().toLowerCase() || '';
      if (takenIds.has(contact.id)) return false;
      if (email && takenEmails.has(email)) return false;
      return Boolean(email);
    });
  }, [attendees, contacts]);

  useEffect(() => {
    if (!open) return;

    const nextDefaults = defaultLocalDateTime();
    setDateYmd(nextDefaults.date);
    setTimeHm(nextDefaults.time);
    setWeekStartYmd(startOfWeekMonday(nextDefaults.date));
    setClientId(prefill?.clientId?.trim() || '');
    setAttendees(attendeesFromPrefill(prefill));
    setManualName('');
    setManualEmail('');
    setContactToAdd('');
    setInviteeNotes('');
    setNotifyInvitee(true);
    setBusy([]);
    setLoadingOptions(true);
    setClientsLoading(true);

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

    void listClients({ accountId, page: 1, pageSize: 100 })
      .then((result) => {
        const rows = Array.isArray((result as { data?: unknown })?.data)
          ? (
              result as {
                data: Array<{
                  id: string;
                  display_name: string | null;
                  company_name?: string | null;
                }>;
              }
            ).data
          : [];
        setClients(
          rows.map((row) => ({
            id: row.id,
            display_name: row.display_name ?? null,
            company_name: row.company_name ?? null,
          })),
        );
      })
      .catch(() => setClients([]))
      .finally(() => setClientsLoading(false));
  }, [
    open,
    accountId,
    prefill?.clientId,
    prefill?.inviteeName,
    prefill?.inviteeEmail,
  ]);

  useEffect(() => {
    if (!selectedEvent) return;
    if (!selectedEvent.durations.includes(durationMinutes)) {
      setDurationMinutes(
        selectedEvent.defaultDuration ?? selectedEvent.durations[0] ?? 30,
      );
    }
  }, [selectedEvent, durationMinutes]);

  useEffect(() => {
    if (!open || !clientId) {
      setContacts([]);
      setContactToAdd('');
      return;
    }

    let cancelled = false;
    setContactsLoading(true);
    void listContacts({ accountId, clientId })
      .then((result) => {
        if (cancelled) return;
        const rows = Array.isArray((result as { data?: unknown })?.data)
          ? (
              result as {
                data: Array<{
                  id: string;
                  full_name: string;
                  email?: string | null;
                }>;
              }
            ).data
          : [];
        setContacts(
          rows.map((row) => ({
            id: row.id,
            full_name: row.full_name,
            email: row.email ?? null,
          })),
        );
      })
      .catch(() => {
        if (!cancelled) setContacts([]);
      })
      .finally(() => {
        if (!cancelled) setContactsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, accountId, clientId]);

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
  }, [open, accountId, accountSlug, weekStartYmd, selectedPage?.hostUserId]);

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
    if (dateYmd < nextWeekStart || dateYmd > addDaysYmd(nextWeekStart, 6)) {
      setDateYmd(nextWeekStart);
    }
  }

  function addAttendee(attendee: Omit<AttendeeDraft, 'key'>) {
    const email = attendee.email.trim().toLowerCase();
    if (!isValidEmail(email)) {
      toast.error('Enter a valid email address');
      return false;
    }
    if (attendees.some((item) => item.email.trim().toLowerCase() === email)) {
      toast.error('That person is already on the invite');
      return false;
    }
    if (attendees.length >= MAX_ATTENDEES) {
      toast.error(`You can add up to ${MAX_ATTENDEES} people`);
      return false;
    }

    setAttendees((current) => [
      ...current,
      {
        key: makeAttendeeKey(),
        name: attendee.name.trim(),
        email,
        contactId: attendee.contactId ?? null,
      },
    ]);
    return true;
  }

  function addManualAttendee() {
    if (
      addAttendee({
        name: manualName,
        email: manualEmail,
        contactId: null,
      })
    ) {
      setManualName('');
      setManualEmail('');
    }
  }

  function addContactAttendee() {
    const contact = contacts.find((item) => item.id === contactToAdd);
    if (!contact?.email) {
      toast.error('Choose a contact with an email address');
      return;
    }
    if (
      addAttendee({
        name: contact.full_name,
        email: contact.email,
        contactId: contact.id,
      })
    ) {
      setContactToAdd('');
    }
  }

  function removeAttendee(key: string) {
    setAttendees((current) => current.filter((item) => item.key !== key));
  }

  function makePrimary(key: string) {
    setAttendees((current) => {
      const index = current.findIndex((item) => item.key === key);
      if (index <= 0) return current;
      const next = [...current];
      const [item] = next.splice(index, 1);
      if (!item) return current;
      return [item, ...next];
    });
  }

  function submit() {
    if (!pageSlug || !eventSlug) {
      toast.error('Choose a booking page and event type');
      return;
    }

    const primary = attendees[0];
    if (!primary?.email || !isValidEmail(primary.email)) {
      toast.error('Add at least one invitee with a valid email');
      return;
    }

    const inviteeName =
      primary.name.trim() || primary.email.split('@')[0] || 'Invitee';
    const guests = attendees.slice(1).map((item) => ({
      name: item.name.trim() || null,
      email: item.email.trim().toLowerCase(),
    }));

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
          inviteeName,
          inviteeEmail: primary.email.trim().toLowerCase(),
          inviteeTimezone: browserTimezone(),
          inviteeNotes: inviteeNotes.trim() || null,
          clientId: clientId || null,
          notifyInvitee,
          guests,
        });
        toast.success(
          notifyInvitee
            ? 'Meeting created and invitees notified'
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

            <div className="space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] p-3">
              <div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Invitees
                </p>
                <p className={`text-xs ${workspaceTextMuted}`}>
                  Assign a client (optional), add contacts, or type any email.
                  The first person is the primary invitee; others are guests.
                </p>
              </div>

              <div className="space-y-2">
                <Label>Client</Label>
                <ClientCombobox
                  clients={clients}
                  value={clientId}
                  onValueChange={setClientId}
                  loading={clientsLoading}
                  placeholder="Optional — link a client"
                />
              </div>

              {attendees.length > 0 ? (
                <ul className="space-y-2">
                  {attendees.map((attendee, index) => (
                    <li
                      key={attendee.key}
                      className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {attendee.name || attendee.email}
                          {index === 0 ? (
                            <span
                              className={`ml-2 text-xs font-normal ${workspaceTextMuted}`}
                            >
                              Primary
                            </span>
                          ) : null}
                        </p>
                        {attendee.name ? (
                          <p
                            className={`truncate text-xs ${workspaceTextMuted}`}
                          >
                            {attendee.email}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex items-center gap-1">
                        {index > 0 ? (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => makePrimary(attendee.key)}
                          >
                            Make primary
                          </Button>
                        ) : null}
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => removeAttendee(attendee.key)}
                          aria-label={`Remove ${attendee.email}`}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className={`text-sm ${workspaceTextMuted}`}>
                  No invitees yet.
                </p>
              )}

              {clientId ? (
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="min-w-0 flex-1 space-y-2">
                    <Label>Add contact</Label>
                    <Select
                      value={contactToAdd || undefined}
                      onValueChange={setContactToAdd}
                      disabled={
                        contactsLoading || availableContacts.length === 0
                      }
                    >
                      <SelectTrigger>
                        <SelectValue
                          placeholder={
                            contactsLoading
                              ? 'Loading contacts…'
                              : availableContacts.length === 0
                                ? 'No contacts with email'
                                : 'Select contact'
                          }
                        />
                      </SelectTrigger>
                      <SelectContent>
                        {availableContacts.map((contact) => (
                          <SelectItem key={contact.id} value={contact.id}>
                            {contact.full_name}
                            {contact.email ? ` · ${contact.email}` : ''}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={addContactAttendee}
                    disabled={!contactToAdd}
                  >
                    <Plus className="mr-1.5 h-4 w-4" />
                    Add contact
                  </Button>
                </div>
              ) : null}

              <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_auto] sm:items-end">
                <div className="space-y-2">
                  <Label htmlFor="create-meeting-manual-name">Name</Label>
                  <Input
                    id="create-meeting-manual-name"
                    value={manualName}
                    onChange={(event) => setManualName(event.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="create-meeting-manual-email">Email</Label>
                  <Input
                    id="create-meeting-manual-email"
                    type="email"
                    value={manualEmail}
                    onChange={(event) => setManualEmail(event.target.value)}
                    placeholder="name@company.com"
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        addManualAttendee();
                      }
                    }}
                  />
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={addManualAttendee}
                  disabled={!manualEmail.trim()}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  Add email
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="create-meeting-notes">Notes (optional)</Label>
              <Textarea
                id="create-meeting-notes"
                value={inviteeNotes}
                onChange={(event) => setInviteeNotes(event.target.value)}
                rows={3}
              />
            </div>

            <label className="flex items-start gap-2">
              <Checkbox
                checked={notifyInvitee}
                onCheckedChange={(value) => setNotifyInvitee(value === true)}
                className="mt-0.5"
              />
              <span className="text-sm">
                Notify invitees
                <span className={`mt-0.5 block text-xs ${workspaceTextMuted}`}>
                  Sends confirmation emails and calendar invite notifications to
                  everyone on the list.
                </span>
              </span>
            </label>
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
