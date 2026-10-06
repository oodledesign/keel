'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { formatPollWhen } from '../_lib/format-poll-time';
import {
  addMeetingPollInviteesAction,
  addMeetingPollSlotsAction,
  resolveManualPollSlotAction,
} from '../_lib/server/meeting-poll-actions';
import { CreateMeetingContactCombobox } from './create-meeting-contact-combobox';

const FIELD =
  'border-[color:var(--workspace-shell-border)] bg-[var(--workspace-control-surface)] text-[var(--workspace-shell-text)]';

type Contact = { id: string; fullName: string; email: string };
type NewPerson = { email: string; name: string; contactId: string | null };

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

/** Add more times / people to a poll that has already been sent. */
export function PollAddMore({
  accountId,
  accountSlug,
  pollId,
  timezone,
  durationMinutes,
  contacts,
  existingEmails,
}: {
  accountId: string;
  accountSlug: string;
  pollId: string;
  timezone: string;
  durationMinutes: number;
  contacts: Contact[];
  existingEmails: string[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [timesOpen, setTimesOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);

  const [date, setDate] = useState(todayYmd);
  const [time, setTime] = useState('10:00');
  const [slots, setSlots] = useState<string[]>([]);

  const [people, setPeople] = useState<NewPerson[]>([]);
  const [contactToAdd, setContactToAdd] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');

  function addSlot() {
    startTransition(async () => {
      try {
        const result = await resolveManualPollSlotAction({
          accountId,
          timezone,
          dateYmd: date,
          timeHm: time,
          durationMinutes,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        const start = result.slot.start;
        setSlots((current) =>
          current.includes(start) ? current : [...current, start].sort(),
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add that time',
        );
      }
    });
  }

  function saveSlots() {
    startTransition(async () => {
      try {
        const result = await addMeetingPollSlotsAction({
          accountId,
          accountSlug,
          pollId,
          slots: slots.map((startAtIso) => ({
            startAtIso,
            source: 'manual' as const,
          })),
          notify: true,
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        const emailed = result.mail.sent.length;
        toast.success(
          `${result.added} time${result.added === 1 ? '' : 's'} added${
            emailed > 0
              ? `. ${emailed} ${emailed === 1 ? 'person was' : 'people were'} emailed.`
              : '.'
          }`,
        );
        if (result.mail.failed.length > 0) {
          toast.error(
            `Could not email ${result.mail.failed.map((row) => row.email).join(', ')}.`,
          );
        }
        setSlots([]);
        setTimesOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add the times',
        );
      }
    });
  }

  function addPerson(person: NewPerson) {
    const normalised = person.email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalised)) {
      toast.error('Enter a valid email');
      return;
    }
    if (
      existingEmails.includes(normalised) ||
      people.some((row) => row.email === normalised)
    ) {
      toast.error('That person is already on the poll');
      return;
    }
    setPeople((current) => [
      ...current,
      { ...person, email: normalised, name: person.name.trim() },
    ]);
  }

  function savePeople() {
    startTransition(async () => {
      try {
        const result = await addMeetingPollInviteesAction({
          accountId,
          accountSlug,
          pollId,
          invitees: people.map((person) => ({
            email: person.email,
            name: person.name || null,
            contactId: person.contactId,
          })),
        });
        if (!result.ok) {
          toast.error(result.message);
          return;
        }
        if (result.mail.failed.length === 0) {
          toast.success(
            `${result.added} ${result.added === 1 ? 'person' : 'people'} invited`,
          );
        } else {
          toast.error(
            `Added, but could not email ${result.mail.failed.map((row) => row.email).join(', ')}. Use "Send invites" to retry.`,
          );
        }
        setPeople([]);
        setPeopleOpen(false);
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add the people',
        );
      }
    });
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        onClick={() => setTimesOpen(true)}
      >
        Add times
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={() => setPeopleOpen(true)}
      >
        Add people
      </Button>

      <Dialog open={timesOpen} onOpenChange={setTimesOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add times</DialogTitle>
            <DialogDescription>
              {durationMinutes} minute times in {timezone}. Anyone who has not
              answered the new times is emailed.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="add-slot-date">Date</Label>
              <Input
                id="add-slot-date"
                type="date"
                value={date}
                min={todayYmd()}
                onChange={(event) => setDate(event.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-slot-time">Time</Label>
              <Input
                id="add-slot-time"
                type="time"
                value={time}
                onChange={(event) => setTime(event.target.value)}
                className={`w-32 ${FIELD}`}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={addSlot}
            >
              Add
            </Button>
          </div>
          {slots.length > 0 ? (
            <ul className="space-y-2">
              {slots.map((slot) => (
                <li
                  key={slot}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
                >
                  <span>{formatPollWhen(slot, timezone)}</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setSlots((current) => current.filter((s) => s !== slot))
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className={`text-sm ${workspaceTextMuted}`}>
              Pick a date and time, then press Add. You can add several.
            </p>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setTimesOpen(false)}
            >
              Back
            </Button>
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending || slots.length === 0}
              onClick={saveSlots}
            >
              Add {slots.length || ''} time{slots.length === 1 ? '' : 's'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={peopleOpen} onOpenChange={setPeopleOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add people</DialogTitle>
            <DialogDescription>
              New people are emailed their own link straight away. Everyone
              already on the poll is left alone.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Contact</Label>
            <CreateMeetingContactCombobox
              contacts={contacts.map((contact) => ({
                id: contact.id,
                full_name: contact.fullName,
                email: contact.email,
              }))}
              value={contactToAdd}
              onValueChange={(value) => {
                const contact = contacts.find((item) => item.id === value);
                if (!contact) return;
                addPerson({
                  email: contact.email,
                  name: contact.fullName,
                  contactId: contact.id,
                });
                setContactToAdd('');
              }}
            />
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="add-person-name">Name</Label>
              <Input
                id="add-person-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className={FIELD}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-person-email">Email</Label>
              <Input
                id="add-person-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={FIELD}
              />
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                addPerson({ email, name, contactId: null });
                setEmail('');
                setName('');
              }}
            >
              Add email
            </Button>
          </div>
          {people.length > 0 ? (
            <ul className="space-y-2">
              {people.map((person) => (
                <li
                  key={person.email}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
                >
                  <span>
                    {person.name || person.email}
                    {person.name ? (
                      <span className={`ml-2 text-xs ${workspaceTextMuted}`}>
                        {person.email}
                      </span>
                    ) : null}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setPeople((current) =>
                        current.filter((row) => row.email !== person.email),
                      )
                    }
                  >
                    Remove
                  </Button>
                </li>
              ))}
            </ul>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setPeopleOpen(false)}
            >
              Back
            </Button>
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending || people.length === 0}
              onClick={savePeople}
            >
              Invite {people.length || ''}{' '}
              {people.length === 1 ? 'person' : 'people'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
