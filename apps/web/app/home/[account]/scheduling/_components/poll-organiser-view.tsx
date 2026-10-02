'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Badge } from '@kit/ui/badge';
import { Button } from '@kit/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import { toast } from '@kit/ui/sonner';

import { workspaceBtnPrimaryMd, workspaceTextMuted } from '~/lib/workspace-ui';

import { formatPollWhen } from '../_lib/format-poll-time';
import {
  cancelMeetingPollAction,
  confirmMeetingPollSlotAction,
  previewMeetingPollSlotAction,
  remindMeetingPollAction,
  resendMeetingPollConfirmationAction,
  sendMeetingPollInvitesAction,
} from '../_lib/server/meeting-poll-actions';
import type { MeetingPollDetail } from '../_lib/server/meeting-polls.service';

type PollVote = 'yes' | 'if_need_be' | 'no';

const ANSWER_LABEL: Record<PollVote, string> = {
  yes: 'Yes',
  if_need_be: 'If need be',
  no: 'No',
};

export function PollOrganiserView({
  accountId,
  accountSlug,
  canEdit,
  poll,
}: {
  accountId: string;
  accountSlug: string;
  canEdit: boolean;
  poll: MeetingPollDetail;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [remindOpen, setRemindOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [confirmSlotId, setConfirmSlotId] = useState<string | null>(null);
  const [confirmConflicts, setConfirmConflicts] = useState(false);
  const [checkedGoogle, setCheckedGoogle] = useState(true);

  const waiting = poll.invitees.filter(
    (invitee) => invitee.invitedAt && !invitee.respondedAt,
  );
  const unsent = poll.invitees.filter((invitee) => !invitee.invitedAt);
  const best = [...poll.slots]
    .sort((left, right) => left.rank - right.rank)
    .slice(0, 3);
  const confirmSlot = poll.slots.find((slot) => slot.id === confirmSlotId);

  function refresh() {
    router.refresh();
  }

  function reportMail(
    mail: { sent: string[]; failed: Array<{ email: string }> },
    success: string,
  ) {
    if (mail.failed.length === 0) {
      toast.success(success);
      return;
    }
    const sentNote = mail.sent.length > 0 ? `${success} ` : '';
    toast.error(
      `${sentNote}Could not email ${mail.failed.map((row) => row.email).join(', ')}.`,
    );
  }

  function sendUnsent() {
    startTransition(async () => {
      try {
        const result = await sendMeetingPollInvitesAction({
          accountId,
          accountSlug,
          pollId: poll.id,
        });
        reportMail(result.mail, 'Invites sent');
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send invites',
        );
      }
    });
  }

  function remind() {
    startTransition(async () => {
      try {
        const result = await remindMeetingPollAction({
          accountId,
          accountSlug,
          pollId: poll.id,
        });
        reportMail(
          result.mail,
          result.mail.sent.length === 0
            ? 'Everyone has already responded'
            : 'Reminders sent',
        );
        setRemindOpen(false);
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not send reminders',
        );
      }
    });
  }

  function beginConfirm(slotId: string) {
    startTransition(async () => {
      try {
        const preview = await previewMeetingPollSlotAction({
          accountId,
          accountSlug,
          pollId: poll.id,
          slotId,
        });
        setConfirmConflicts(preview.conflicts);
        setCheckedGoogle(preview.checkedGoogleCalendar);
        setConfirmSlotId(slotId);
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not check the calendar',
        );
      }
    });
  }

  function confirm(acknowledgeConflict: boolean) {
    if (!confirmSlotId) return;
    startTransition(async () => {
      try {
        const result = await confirmMeetingPollSlotAction({
          accountId,
          accountSlug,
          pollId: poll.id,
          slotId: confirmSlotId,
          acknowledgeConflict,
        });
        if (result.status === 'conflict') {
          setConfirmConflicts(true);
          setCheckedGoogle(result.checkedGoogleCalendar);
          return;
        }
        const where =
          result.calendarProvider === 'google'
            ? 'Added to Google Calendar.'
            : 'Saved on your Ozer calendar.';
        reportMail(result.mail, `Time confirmed. ${where}`);
        setConfirmSlotId(null);
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not confirm the time',
        );
      }
    });
  }

  function cancelPoll() {
    startTransition(async () => {
      try {
        await cancelMeetingPollAction({
          accountId,
          accountSlug,
          pollId: poll.id,
        });
        toast.success('Poll cancelled');
        setCancelOpen(false);
        refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not cancel the poll',
        );
      }
    });
  }

  function resend() {
    startTransition(async () => {
      try {
        const result = await resendMeetingPollConfirmationAction({
          accountId,
          accountSlug,
          pollId: poll.id,
        });
        reportMail(result.mail, 'Calendar invite resent');
      } catch (error) {
        toast.error(
          error instanceof Error
            ? error.message
            : 'Could not resend the invite',
        );
      }
    });
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-semibold">{poll.title}</h2>
            <Badge variant="outline">{statusLabel(poll.status)}</Badge>
          </div>
          {poll.description ? (
            <p className={`mt-2 max-w-2xl ${workspaceTextMuted}`}>
              {poll.description}
            </p>
          ) : null}
          <p className={`mt-2 text-sm ${workspaceTextMuted}`}>
            {poll.durationMinutes} minutes · times shown in {poll.timezone}
            {poll.clientLabel ? ` · ${poll.clientLabel}` : ''}
            {poll.projectLabel ? ` · ${poll.projectLabel}` : ''}
          </p>
          {poll.status === 'closed' && poll.chosenSlotId ? (
            <p className="mt-2 text-sm">
              Confirmed:{' '}
              {formatPollWhen(
                poll.slots.find((slot) => slot.id === poll.chosenSlotId)
                  ?.startsAt ?? '',
                poll.timezone,
              )}
              {poll.calendarProvider === 'google'
                ? ' · on Google Calendar'
                : poll.calendarProvider === 'ozer'
                  ? ' · on your Ozer calendar'
                  : ''}
              {poll.conferencingUrl ? ` · ${poll.conferencingUrl}` : ''}
            </p>
          ) : null}
        </div>
        {canEdit && (poll.status === 'draft' || poll.status === 'open') ? (
          <Button
            type="button"
            variant="outline"
            onClick={() => setCancelOpen(true)}
          >
            Cancel poll
          </Button>
        ) : null}
      </div>

      {canEdit && unsent.length > 0 && poll.status !== 'cancelled' ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[color:var(--workspace-shell-border)] p-4">
          <p>
            {unsent.length} invite{unsent.length === 1 ? '' : 's'} not sent yet.
          </p>
          <button
            type="button"
            className={workspaceBtnPrimaryMd}
            disabled={pending}
            onClick={sendUnsent}
          >
            Send invites
          </button>
        </div>
      ) : null}

      <section className="space-y-2">
        <h3 className="text-lg font-semibold">Best times</h3>
        <ol className="space-y-2">
          {best.map((slot) => (
            <li
              key={slot.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2"
            >
              <span>
                <span className="font-medium">
                  {slot.rank}. {formatPollWhen(slot.startsAt, poll.timezone)}
                </span>
                <span className={`ml-2 text-sm ${workspaceTextMuted}`}>
                  {slot.yes} yes · {slot.ifNeedBe} if need be · {slot.no} no ·{' '}
                  {slot.pending} waiting
                </span>
              </span>
              {canEdit && poll.status === 'open' ? (
                <Button
                  type="button"
                  variant="outline"
                  disabled={pending}
                  onClick={() => beginConfirm(slot.id)}
                >
                  Choose this time
                </Button>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      <section className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-lg font-semibold">Responses</h3>
          {canEdit && poll.status === 'open' ? (
            <Button
              type="button"
              variant="outline"
              disabled={pending || waiting.length === 0}
              onClick={() => setRemindOpen(true)}
            >
              Remind {waiting.length} waiting
            </Button>
          ) : null}
        </div>
        <div className="overflow-x-auto rounded-2xl border border-[color:var(--workspace-shell-border)]">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="border-b border-[color:var(--workspace-shell-border)] text-left">
                <th className="sticky left-0 bg-[var(--workspace-shell-panel)] px-3 py-2">
                  Invitee
                </th>
                {poll.slots.map((slot) => (
                  <th
                    key={slot.id}
                    className="px-3 py-2 font-medium whitespace-nowrap"
                  >
                    {formatPollWhen(slot.startsAt, poll.timezone)}
                    {slot.id === poll.chosenSlotId ? ' · chosen' : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {poll.invitees.map((invitee) => (
                <tr
                  key={invitee.id}
                  className="border-b border-[color:var(--workspace-shell-border)]"
                >
                  <th className="sticky left-0 bg-[var(--workspace-shell-panel)] px-3 py-2 text-left font-normal">
                    <span className="block">
                      {invitee.name || invitee.email}
                    </span>
                    <span className={`block text-xs ${workspaceTextMuted}`}>
                      {inviteeStatus(invitee)}
                    </span>
                  </th>
                  {poll.slots.map((slot) => {
                    const answer = invitee.answers.find(
                      (row) => row.slotId === slot.id,
                    )?.answer;
                    return (
                      <td key={slot.id} className="px-3 py-2 whitespace-nowrap">
                        {answer ? ANSWER_LABEL[answer] : '—'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {canEdit && poll.status === 'closed' ? (
        <Button
          type="button"
          variant="outline"
          disabled={pending}
          onClick={resend}
        >
          Resend calendar invite
        </Button>
      ) : null}

      <Dialog open={remindOpen} onOpenChange={setRemindOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send reminders?</DialogTitle>
          </DialogHeader>
          <p>
            This emails {waiting.length}{' '}
            {waiting.length === 1 ? 'person who has' : 'people who have'} not
            responded. No one else is emailed.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRemindOpen(false)}
            >
              Back
            </Button>
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={remind}
            >
              Send reminders
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(confirmSlot)}
        onOpenChange={(open) => {
          if (!open) setConfirmSlotId(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmConflicts
                ? 'This time is now busy'
                : 'Confirm this time?'}
            </DialogTitle>
          </DialogHeader>
          {confirmSlot ? (
            <p>
              {formatPollWhen(confirmSlot.startsAt, poll.timezone)} (
              {poll.timezone}).
              {confirmConflicts
                ? ' It overlaps something on your calendar.'
                : ' It is free on the calendars Ozer can see.'}{' '}
              {checkedGoogle
                ? 'Google Calendar was checked.'
                : 'Google Calendar is not connected, so only Ozer bookings and events were checked.'}{' '}
              Confirming emails everyone a calendar invite.
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmSlotId(null)}
            >
              Back
            </Button>
            <button
              type="button"
              className={workspaceBtnPrimaryMd}
              disabled={pending}
              onClick={() => confirm(confirmConflicts)}
            >
              {confirmConflicts
                ? 'Book anyway and email everyone'
                : 'Confirm and email everyone'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel this poll?</DialogTitle>
          </DialogHeader>
          <p>
            Invitees will see that it was cancelled. This does not send an
            email.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCancelOpen(false)}
            >
              Keep poll
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={pending}
              onClick={cancelPoll}
            >
              Cancel poll
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function statusLabel(status: MeetingPollDetail['status']) {
  if (status === 'draft') return 'Draft';
  if (status === 'open') return 'Open';
  if (status === 'closed') return 'Confirmed';
  return 'Cancelled';
}

function inviteeStatus(invitee: MeetingPollDetail['invitees'][number]) {
  if (!invitee.invitedAt) return 'Invite not sent';
  if (invitee.respondedAt) return 'Responded';
  if (invitee.lastRemindedAt) return 'Waiting · reminded';
  return 'Waiting';
}
