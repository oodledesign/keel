'use client';

import { useMemo, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
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

import pathsConfig from '~/config/paths.config';
import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { formatPollWhen } from '../_lib/format-poll-time';
import {
  cancelMeetingPollAction,
  resolveManualPollSlotAction,
  saveMeetingPollAction,
  suggestMeetingPollSlotsAction,
} from '../_lib/server/meeting-poll-actions';
import { CreateMeetingContactCombobox } from './create-meeting-contact-combobox';

const FIELD =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]';

const DURATIONS = [15, 30, 45, 60, 90, 120];

const TIMEZONES = [
  'Europe/London',
  'Europe/Dublin',
  'Europe/Paris',
  'Europe/Berlin',
  'Europe/Amsterdam',
  'Europe/Madrid',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'UTC',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Australia/Sydney',
];

type ContactOption = { id: string; fullName: string; email: string };
type ClientOption = { id: string; label: string };
type ProjectOption = { id: string; label: string; clientId: string | null };
type DraftSlot = { startAtIso: string; source: 'suggested' | 'manual' };
type DraftInvitee = { email: string; name: string; contactId: string | null };

export type CreatePollInitial = {
  pollId?: string;
  title: string;
  description: string;
  location: string;
  durationMinutes: number;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  showVoterNames: boolean;
  clientId: string;
  projectId: string;
  slots: DraftSlot[];
  invitees: DraftInvitee[];
};

type Props = {
  accountId: string;
  accountSlug: string;
  rangeStart: string;
  rangeEnd: string;
  contacts: ContactOption[];
  clients: ClientOption[];
  projects: ProjectOption[];
  initial?: CreatePollInitial;
};

export function CreatePollForm({
  accountId,
  accountSlug,
  rangeStart,
  rangeEnd,
  contacts,
  clients,
  projects,
  initial,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [durationMinutes, setDurationMinutes] = useState(
    initial?.durationMinutes ?? 30,
  );
  const [startDate, setStartDate] = useState(initial?.rangeStart ?? rangeStart);
  const [endDate, setEndDate] = useState(initial?.rangeEnd ?? rangeEnd);
  const [timezone, setTimezone] = useState(
    initial?.timezone ?? 'Europe/London',
  );
  const [showVoterNames, setShowVoterNames] = useState(
    initial?.showVoterNames ?? true,
  );
  const [clientId, setClientId] = useState(initial?.clientId ?? '');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [slots, setSlots] = useState<DraftSlot[]>(initial?.slots ?? []);
  const [invitees, setInvitees] = useState<DraftInvitee[]>(
    initial?.invitees ?? [],
  );
  const [contactToAdd, setContactToAdd] = useState('');
  const [manualName, setManualName] = useState('');
  const [manualEmail, setManualEmail] = useState('');
  const [manualDate, setManualDate] = useState(
    initial?.rangeStart ?? rangeStart,
  );
  const [manualTime, setManualTime] = useState('10:00');
  const [suggestionNote, setSuggestionNote] = useState('');

  const zones = useMemo(
    () => (TIMEZONES.includes(timezone) ? TIMEZONES : [timezone, ...TIMEZONES]),
    [timezone],
  );

  const visibleProjects = projects.filter(
    (project) =>
      !clientId || !project.clientId || project.clientId === clientId,
  );

  function addInvitee(next: DraftInvitee) {
    const email = next.email.trim().toLowerCase();
    if (!email) return;
    setInvitees((current) => {
      if (current.some((item) => item.email.toLowerCase() === email)) {
        return current;
      }
      return [...current, { ...next, email }];
    });
  }

  function suggest() {
    startTransition(async () => {
      try {
        const result = await suggestMeetingPollSlotsAction({
          accountId,
          accountSlug,
          timezone,
          durationMinutes,
          rangeStartYmd: startDate,
          rangeEndYmd: endDate,
        });
        setSlots((current) => {
          const manual = current.filter((slot) => slot.source === 'manual');
          const suggested = result.slots.map((slot) => ({
            startAtIso: slot.start,
            source: 'suggested' as const,
          }));
          const seen = new Set(manual.map((slot) => slot.startAtIso));
          return [
            ...manual,
            ...suggested.filter((slot) => !seen.has(slot.startAtIso)),
          ].sort((left, right) =>
            left.startAtIso.localeCompare(right.startAtIso),
          );
        });
        const hours =
          result.workingHoursSource === 'schedule'
            ? 'your availability schedule'
            : 'weekday hours, 09:00–17:00';
        const calendar = result.checkedGoogleCalendar
          ? 'Busy times on the connected Google Calendar were skipped.'
          : 'Google Calendar is not connected, so only working hours were used.';
        setSuggestionNote(
          result.slots.length === 0
            ? `No free times in that range from ${hours}. Add times manually.`
            : `Suggested ${result.slots.length} times from ${hours}. ${calendar}`,
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not suggest times',
        );
      }
    });
  }

  function addManualSlot() {
    startTransition(async () => {
      try {
        const slot = await resolveManualPollSlotAction({
          accountId,
          timezone,
          dateYmd: manualDate,
          timeHm: manualTime,
          durationMinutes,
        });
        setSlots((current) => {
          if (current.some((item) => item.startAtIso === slot.start)) {
            return current;
          }
          return [
            ...current,
            { startAtIso: slot.start, source: 'manual' as const },
          ].sort((left, right) =>
            left.startAtIso.localeCompare(right.startAtIso),
          );
        });
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add that time',
        );
      }
    });
  }

  function save(send: boolean) {
    startTransition(async () => {
      try {
        const result = await saveMeetingPollAction({
          accountId,
          accountSlug,
          pollId: initial?.pollId,
          title,
          description,
          location,
          durationMinutes,
          rangeStartYmd: startDate,
          rangeEndYmd: endDate,
          timezone,
          showVoterNames,
          clientId: clientId || null,
          projectId: projectId || null,
          slots: slots.map((slot) => ({
            startAtIso: slot.startAtIso,
            source: slot.source,
          })),
          invitees: invitees.map((invitee) => ({
            email: invitee.email,
            name: invitee.name || null,
            contactId: invitee.contactId,
          })),
          send,
        });

        if (send) {
          const failed = result.mail.failed.length;
          if (failed > 0) {
            toast.error(
              `Poll sent, but ${failed} invite${failed === 1 ? '' : 's'} could not be emailed.`,
            );
          } else {
            toast.success('Poll sent');
          }
        } else {
          toast.success('Draft saved');
        }

        router.push(
          pathsConfig.app.accountSchedulingPoll
            .replace('[account]', accountSlug)
            .replace('[pollId]', result.pollId),
        );
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save the poll',
        );
      }
    });
  }

  return (
    <div className="space-y-8">
      <section className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="poll-title">Title</Label>
          <Input
            id="poll-title"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={FIELD}
            placeholder="Design review"
          />
        </div>
        <div className="space-y-2 md:col-span-2">
          <Label htmlFor="poll-description">Description</Label>
          <Textarea
            id="poll-description"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            className={FIELD}
            rows={3}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll-location">Location</Label>
          <Input
            id="poll-location"
            value={location}
            onChange={(event) => setLocation(event.target.value)}
            className={FIELD}
            placeholder="Leave blank to add a Google Meet link when you confirm"
          />
        </div>
        <div className="space-y-2">
          <Label>Duration</Label>
          <Select
            value={String(durationMinutes)}
            onValueChange={(value) => setDurationMinutes(Number(value))}
          >
            <SelectTrigger className={FIELD}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((minutes) => (
                <SelectItem key={minutes} value={String(minutes)}>
                  {minutes} minutes
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll-start">From</Label>
          <Input
            id="poll-start"
            type="date"
            value={startDate}
            onChange={(event) => setStartDate(event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="poll-end">To</Label>
          <Input
            id="poll-end"
            type="date"
            value={endDate}
            onChange={(event) => setEndDate(event.target.value)}
            className={FIELD}
          />
        </div>
        <div className="space-y-2">
          <Label>Your timezone</Label>
          <Select value={timezone} onValueChange={setTimezone}>
            <SelectTrigger className={FIELD}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {zones.map((zone) => (
                <SelectItem key={zone} value={zone}>
                  {zone}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Who can see votes</Label>
          <Select
            value={showVoterNames ? 'names' : 'counts'}
            onValueChange={(value) => setShowVoterNames(value === 'names')}
          >
            <SelectTrigger className={FIELD}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="names">Show voter names</SelectItem>
              <SelectItem value="counts">Counts only</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Client</Label>
          <Select
            value={clientId || 'none'}
            onValueChange={(value) => {
              setClientId(value === 'none' ? '' : value);
              setProjectId('');
            }}
          >
            <SelectTrigger className={FIELD}>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No client</SelectItem>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label>Project</Label>
          <Select
            value={projectId || 'none'}
            onValueChange={(value) =>
              setProjectId(value === 'none' ? '' : value)
            }
          >
            <SelectTrigger className={FIELD}>
              <SelectValue placeholder="Optional" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No project</SelectItem>
              {visibleProjects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold">Times</h2>
            <p className={`text-sm ${workspaceTextMuted}`}>
              Suggestions use your working hours and connected Google Calendar.
              Outlook calendars are not checked yet. Nothing is emailed until
              you send the poll.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={suggest}
          >
            Suggest times
          </Button>
        </div>
        {suggestionNote ? (
          <p className={`text-sm ${workspaceTextMuted}`}>{suggestionNote}</p>
        ) : null}
        <ul className="space-y-2">
          {slots.map((slot) => (
            <li
              key={slot.startAtIso}
              className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
            >
              <span>
                {formatPollWhen(slot.startAtIso, timezone)}
                <span className={`ml-2 text-xs ${workspaceTextMuted}`}>
                  {slot.source === 'manual' ? 'Added by you' : 'Suggested'}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Remove time"
                onClick={() =>
                  setSlots((current) =>
                    current.filter(
                      (item) => item.startAtIso !== slot.startAtIso,
                    ),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="manual-date">Add a time</Label>
            <Input
              id="manual-date"
              type="date"
              value={manualDate}
              onChange={(event) => setManualDate(event.target.value)}
              className={FIELD}
            />
          </div>
          <Input
            type="time"
            value={manualTime}
            onChange={(event) => setManualTime(event.target.value)}
            className={`w-32 ${FIELD}`}
            aria-label="Time"
          />
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={addManualSlot}
          >
            Add time
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Invitees</h2>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[220px] flex-1 space-y-1">
            <Label>Contact</Label>
            <CreateMeetingContactCombobox
              contacts={contacts.map((contact) => ({
                id: contact.id,
                full_name: contact.fullName,
                email: contact.email,
              }))}
              value={contactToAdd}
              onValueChange={(value) => {
                setContactToAdd(value);
                const contact = contacts.find((item) => item.id === value);
                if (!contact) return;
                addInvitee({
                  email: contact.email,
                  name: contact.fullName,
                  contactId: contact.id,
                });
                setContactToAdd('');
              }}
            />
          </div>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label htmlFor="invitee-name">Name</Label>
            <Input
              id="invitee-name"
              value={manualName}
              onChange={(event) => setManualName(event.target.value)}
              className={FIELD}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="invitee-email">Email</Label>
            <Input
              id="invitee-email"
              type="email"
              value={manualEmail}
              onChange={(event) => setManualEmail(event.target.value)}
              className={FIELD}
            />
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              addInvitee({
                email: manualEmail,
                name: manualName,
                contactId: null,
              });
              setManualEmail('');
              setManualName('');
            }}
          >
            Add email
          </Button>
        </div>
        <ul className="space-y-2">
          {invitees.map((invitee) => (
            <li
              key={invitee.email}
              className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
            >
              <span>
                {invitee.name || invitee.email}
                {invitee.name ? (
                  <span className={`ml-2 text-sm ${workspaceTextMuted}`}>
                    {invitee.email}
                  </span>
                ) : null}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Remove ${invitee.email}`}
                onClick={() =>
                  setInvitees((current) =>
                    current.filter((item) => item.email !== invitee.email),
                  )
                }
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
        </ul>
      </section>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={() => save(false)}
        >
          Save draft
        </Button>
        <button
          type="button"
          className={workspaceBtnPrimaryMd}
          disabled={pending}
          onClick={() => save(true)}
        >
          Send poll
        </button>
        {initial?.pollId ? (
          <Button
            type="button"
            variant="outline"
            disabled={pending}
            onClick={() => {
              const pollId = initial.pollId;
              if (!pollId) return;
              startTransition(async () => {
                try {
                  await cancelMeetingPollAction({
                    accountId,
                    accountSlug,
                    pollId,
                  });
                  toast.success('Poll cancelled. No email was sent.');
                  router.push(
                    pathsConfig.app.accountSchedulingPolls.replace(
                      '[account]',
                      accountSlug,
                    ),
                  );
                  router.refresh();
                } catch (error) {
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not cancel the poll',
                  );
                }
              });
            }}
          >
            Cancel poll
          </Button>
        ) : null}
      </div>
    </div>
  );
}
