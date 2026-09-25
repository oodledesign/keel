import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { randomBytes } from 'node:crypto';
import type { z } from 'zod';

import {
  GoogleCalendarNotConnectedError,
  GoogleCalendarReconnectRequiredError,
} from '@kit/scheduling';
import { getBusyIntervals } from '@kit/scheduling/google';
import {
  type PollVote,
  WEEKDAY_WORKING_HOURS,
  localPollSlot,
  rankPollSlots,
  slotConflictsWithBusy,
  suggestPollSlots,
} from '@kit/scheduling/polls';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createGoogleBookingCalendarEvent } from '~/book/_lib/server/google-booking-event';
import {
  type PollMailResult,
  sendPollConfirmationEmails,
  sendPollInviteEmails,
  sendPollReminderEmails,
} from '~/lib/scheduling/meeting-polls/emails';

import type {
  ConfirmMeetingPollSchema,
  ResolveManualPollSlotSchema,
  SaveMeetingPollSchema,
  SuggestMeetingPollSlotsSchema,
} from '../schema/meeting-poll.schema';

type AnyClient = SupabaseClient;

function table(client: AnyClient, name: string) {
  return (
    client as unknown as { from: (n: string) => ReturnType<AnyClient['from']> }
  ).from(name);
}

function throwIfError(error: { message: string } | null, fallback: string) {
  if (error) {
    throw new Error(error.message || fallback);
  }
}

export type MeetingPollStatus = 'draft' | 'open' | 'closed' | 'cancelled';

export type MeetingPollListRow = {
  id: string;
  title: string;
  status: MeetingPollStatus;
  durationMinutes: number;
  timezone: string;
  rangeStart: string;
  rangeEnd: string;
  createdAt: string;
  inviteeCount: number;
  respondedCount: number;
};

export type MeetingPollDetail = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  durationMinutes: number;
  rangeStart: string;
  rangeEnd: string;
  timezone: string;
  showVoterNames: boolean;
  status: MeetingPollStatus;
  clientId: string | null;
  projectId: string | null;
  clientLabel: string | null;
  projectLabel: string | null;
  chosenSlotId: string | null;
  conferencingUrl: string | null;
  calendarProvider: 'google' | 'ozer' | null;
  confirmedAt: string | null;
  slots: Array<{
    id: string;
    startsAt: string;
    endsAt: string;
    source: 'suggested' | 'manual';
    yes: number;
    ifNeedBe: number;
    no: number;
    pending: number;
    rank: number;
  }>;
  invitees: Array<{
    id: string;
    email: string;
    name: string | null;
    contactId: string | null;
    respondedAt: string | null;
    invitedAt: string | null;
    lastRemindedAt: string | null;
    answers: Array<{ slotId: string; answer: PollVote }>;
  }>;
};

type PollRow = {
  id: string;
  account_id: string;
  host_user_id: string;
  title: string;
  description: string | null;
  location: string | null;
  duration_minutes: number;
  range_start: string;
  range_end: string;
  timezone: string;
  show_voter_names: boolean;
  status: MeetingPollStatus;
  client_id: string | null;
  project_id: string | null;
  chosen_slot_id: string | null;
  conferencing_url: string | null;
  calendar_provider: 'google' | 'ozer' | null;
  calendar_event_id: string | null;
  confirmed_at: string | null;
};

type SlotRow = {
  id: string;
  starts_at: string;
  ends_at: string;
  source: 'suggested' | 'manual';
};

type InviteeRow = {
  id: string;
  email: string;
  name: string | null;
  contact_id: string | null;
  token: string;
  responded_at: string | null;
  invited_at: string | null;
  last_reminded_at: string | null;
};

const EMPTY_MAIL: PollMailResult = { sent: [], failed: [] };

export function createMeetingPollsService(client: SupabaseClient) {
  return new MeetingPollsService(client);
}

class MeetingPollsService {
  constructor(private readonly client: SupabaseClient) {}

  async listPolls(accountId: string): Promise<MeetingPollListRow[]> {
    const { data, error } = await table(this.client, 'meeting_polls')
      .select(
        'id, title, status, duration_minutes, timezone, range_start, range_end, created_at, meeting_poll_invitees(id, responded_at)',
      )
      .eq('account_id', accountId)
      .order('created_at', { ascending: false });

    throwIfError(error, 'Could not load meeting polls');

    return ((data ?? []) as Array<Record<string, unknown>>).map((row) => {
      const invitees = (row.meeting_poll_invitees ?? []) as Array<{
        responded_at?: string | null;
      }>;
      return {
        id: String(row.id),
        title: String(row.title),
        status: row.status as MeetingPollStatus,
        durationMinutes: Number(row.duration_minutes),
        timezone: String(row.timezone),
        rangeStart: String(row.range_start),
        rangeEnd: String(row.range_end),
        createdAt: String(row.created_at),
        inviteeCount: invitees.length,
        respondedCount: invitees.filter((invitee) => invitee.responded_at)
          .length,
      };
    });
  }

  async listFormOptions(accountId: string) {
    const [contactsResult, clientsResult, projectsResult] = await Promise.all([
      table(this.client, 'contacts')
        .select('id, full_name, email')
        .eq('account_id', accountId)
        .order('full_name', { ascending: true })
        .limit(500),
      table(this.client, 'clients')
        .select('id, display_name, company_name')
        .eq('account_id', accountId)
        .order('display_name', { ascending: true })
        .limit(200),
      table(this.client, 'projects')
        .select('id, name, client_id')
        .eq('account_id', accountId)
        .order('name', { ascending: true })
        .limit(200),
    ]);

    const contacts = (
      (contactsResult.data ?? []) as Array<{
        id: string;
        full_name: string | null;
        email: string | null;
      }>
    )
      .filter((contact) => contact.email?.trim())
      .map((contact) => ({
        id: contact.id,
        fullName: contact.full_name?.trim() || contact.email!.trim(),
        email: contact.email!.trim(),
      }));

    const clients = (
      (clientsResult.data ?? []) as Array<{
        id: string;
        display_name: string | null;
        company_name: string | null;
      }>
    ).map((client) => ({
      id: client.id,
      label:
        client.display_name?.trim() ||
        client.company_name?.trim() ||
        'Untitled client',
    }));

    const projects = (
      (projectsResult.data ?? []) as Array<{
        id: string;
        name: string | null;
        client_id: string | null;
      }>
    ).map((project) => ({
      id: project.id,
      label: project.name?.trim() || 'Untitled project',
      clientId: project.client_id,
    }));

    return { contacts, clients, projects };
  }

  async getPoll(accountId: string, pollId: string): Promise<MeetingPollDetail> {
    const poll = await this.requirePoll(accountId, pollId);
    const [slots, invitees, responses, labels] = await Promise.all([
      this.listSlots(poll.id),
      this.listInvitees(poll.id),
      this.listResponses(poll.id),
      this.loadLinkLabels(accountId, poll.client_id, poll.project_id),
    ]);

    const ranked = rankPollSlots({
      slots: slots.map((slot) => ({ id: slot.id, startsAt: slot.starts_at })),
      inviteeIds: invitees.map((invitee) => invitee.id),
      responses,
    });
    const rankById = new Map(ranked.map((row) => [row.slotId, row]));

    return {
      id: poll.id,
      title: poll.title,
      description: poll.description,
      location: poll.location,
      durationMinutes: poll.duration_minutes,
      rangeStart: poll.range_start,
      rangeEnd: poll.range_end,
      timezone: poll.timezone,
      showVoterNames: poll.show_voter_names,
      status: poll.status,
      clientId: poll.client_id,
      projectId: poll.project_id,
      clientLabel: labels.clientLabel,
      projectLabel: labels.projectLabel,
      chosenSlotId: poll.chosen_slot_id,
      conferencingUrl: poll.conferencing_url,
      calendarProvider: poll.calendar_provider,
      confirmedAt: poll.confirmed_at,
      slots: slots.map((slot) => {
        const rank = rankById.get(slot.id);
        return {
          id: slot.id,
          startsAt: slot.starts_at,
          endsAt: slot.ends_at,
          source: slot.source,
          yes: rank?.yes ?? 0,
          ifNeedBe: rank?.ifNeedBe ?? 0,
          no: rank?.no ?? 0,
          pending: rank?.pending ?? invitees.length,
          rank: rank?.rank ?? 0,
        };
      }),
      invitees: invitees.map((invitee) => ({
        id: invitee.id,
        email: invitee.email,
        name: invitee.name,
        contactId: invitee.contact_id,
        respondedAt: invitee.responded_at,
        invitedAt: invitee.invited_at,
        lastRemindedAt: invitee.last_reminded_at,
        answers: responses
          .filter((response) => response.inviteeId === invitee.id)
          .map((response) => ({
            slotId: response.slotId,
            answer: response.answer,
          })),
      })),
    };
  }

  async suggestSlots(
    input: z.infer<typeof SuggestMeetingPollSlotsSchema>,
    hostUserId: string,
  ) {
    assertTimeZone(input.timezone);
    assertRange(input.rangeStartYmd, input.rangeEndYmd);

    const hours = await this.loadWorkingHours(input.accountId);
    const from = localPollSlot({
      timezone: input.timezone,
      dateYmd: input.rangeStartYmd,
      timeHm: '00:00',
      durationMinutes: 1,
    }).start;
    const to = localPollSlot({
      timezone: input.timezone,
      dateYmd: input.rangeEndYmd,
      timeHm: '00:00',
      durationMinutes: 24 * 60,
    }).end;

    const busy = await this.loadOrganiserBusy(
      input.accountId,
      hostUserId,
      from,
      to,
      input.timezone,
    );

    const slots = suggestPollSlots({
      timezone: input.timezone,
      rules: hours.rules,
      overrides: hours.overrides,
      busyIntervals: busy.intervals,
      durationMinutes: input.durationMinutes,
      rangeStartYmd: input.rangeStartYmd,
      rangeEndYmd: input.rangeEndYmd,
      now: new Date(),
      minimumNoticeMinutes: 60,
    });

    return {
      slots: slots.map((slot) => ({
        start: slot.start.toISOString(),
        end: slot.end.toISOString(),
      })),
      workingHoursSource: hours.source,
      checkedGoogleCalendar: busy.checkedGoogle,
    };
  }

  resolveManualSlot(input: z.infer<typeof ResolveManualPollSlotSchema>) {
    assertTimeZone(input.timezone);
    const slot = localPollSlot({
      timezone: input.timezone,
      dateYmd: input.dateYmd,
      timeHm: input.timeHm,
      durationMinutes: input.durationMinutes,
    });

    if (slot.start.getTime() < Date.now() - 60_000) {
      throw new Error('Choose a time in the future');
    }

    return {
      start: slot.start.toISOString(),
      end: slot.end.toISOString(),
    };
  }

  async savePoll(
    input: z.infer<typeof SaveMeetingPollSchema>,
    hostUserId: string,
  ) {
    assertTimeZone(input.timezone);
    assertRange(input.rangeStartYmd, input.rangeEndYmd);
    await this.assertLinks(input.accountId, input.clientId, input.projectId);

    const invitees = await this.normaliseInvitees(
      input.accountId,
      input.invitees,
    );
    if (input.send && invitees.length === 0) {
      throw new Error('Add at least one invitee before sending');
    }

    const slots = normaliseSlots(input.slots, input.durationMinutes, {
      requireFuture: input.send,
    });
    const payload = {
      title: input.title.trim(),
      description: blankToNull(input.description),
      location: blankToNull(input.location),
      duration_minutes: input.durationMinutes,
      range_start: input.rangeStartYmd,
      range_end: input.rangeEndYmd,
      timezone: input.timezone,
      show_voter_names: input.showVoterNames,
      client_id: input.clientId ?? null,
      project_id: input.projectId ?? null,
    };

    let pollId = input.pollId;

    if (pollId) {
      const existing = await this.requirePoll(input.accountId, pollId);
      if (existing.status !== 'draft') {
        throw new Error('This poll has already been sent');
      }

      const { error } = await table(this.client, 'meeting_polls')
        .update(payload)
        .eq('id', pollId)
        .eq('account_id', input.accountId)
        .eq('status', 'draft');
      throwIfError(error, 'Could not update the poll');
      await this.replaceDraftChildren(pollId, slots, invitees);
    } else {
      const { data, error } = await table(this.client, 'meeting_polls')
        .insert({
          ...payload,
          account_id: input.accountId,
          host_user_id: hostUserId,
          status: 'draft',
        })
        .select('id')
        .single();
      throwIfError(error, 'Could not create the poll');
      pollId = String((data as { id: string }).id);
      await this.replaceDraftChildren(pollId, slots, invitees);
    }

    const mail = input.send
      ? await this.sendUnsentInvites(input.accountId, pollId)
      : EMPTY_MAIL;

    return { pollId, mail };
  }

  async sendPendingInvites(accountId: string, pollId: string) {
    await this.requirePoll(accountId, pollId);
    return this.sendUnsentInvites(accountId, pollId);
  }

  async remindNonResponders(accountId: string, pollId: string) {
    const poll = await this.requirePoll(accountId, pollId);
    if (poll.status !== 'open') {
      throw new Error('Reminders can only be sent while the poll is open');
    }

    const invitees = (await this.listInvitees(poll.id)).filter(
      (invitee) => !invitee.responded_at && invitee.invited_at,
    );

    if (invitees.length === 0) {
      return EMPTY_MAIL;
    }

    const host = await loadHostIdentity(poll.host_user_id);
    const mail = await sendPollReminderEmails({
      accountId,
      pollId: poll.id,
      title: poll.title,
      organiserName: host.name,
      replyTo: host.email,
      invitees: invitees.map((invitee) => ({
        email: invitee.email,
        name: invitee.name,
        token: invitee.token,
      })),
    });

    if (mail.sent.length > 0) {
      const sent = new Set(mail.sent.map((email) => email.toLowerCase()));
      const ids = invitees
        .filter((invitee) => sent.has(invitee.email))
        .map((invitee) => invitee.id);

      if (ids.length > 0) {
        await table(this.client, 'meeting_poll_invitees')
          .update({ last_reminded_at: new Date().toISOString() })
          .in('id', ids);
      }
    }

    return mail;
  }

  async previewSlot(accountId: string, pollId: string, slotId: string) {
    const poll = await this.requirePoll(accountId, pollId);
    if (poll.status !== 'open') {
      throw new Error('Choose a time while the poll is open');
    }

    const slot = (await this.listSlots(poll.id)).find(
      (row) => row.id === slotId,
    );
    if (!slot) {
      throw new Error('That time is not on this poll');
    }

    const busy = await this.loadOrganiserBusy(
      accountId,
      poll.host_user_id,
      new Date(slot.starts_at),
      new Date(slot.ends_at),
      poll.timezone,
    );

    return {
      conflicts: slotConflictsWithBusy(
        { start: new Date(slot.starts_at), end: new Date(slot.ends_at) },
        busy.intervals,
      ),
      checkedGoogleCalendar: busy.checkedGoogle,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    };
  }

  async confirmSlot(
    input: z.infer<typeof ConfirmMeetingPollSchema>,
    hostUserId: string,
  ) {
    const poll = await this.requirePoll(input.accountId, input.pollId);
    if (poll.status !== 'open') {
      throw new Error('This poll is no longer open');
    }
    if (poll.host_user_id !== hostUserId) {
      throw new Error('Only the organiser can confirm this poll');
    }

    const slot = (await this.listSlots(poll.id)).find(
      (row) => row.id === input.slotId,
    );
    if (!slot) {
      throw new Error('That time is not on this poll');
    }

    const busy = await this.loadOrganiserBusy(
      input.accountId,
      hostUserId,
      new Date(slot.starts_at),
      new Date(slot.ends_at),
      poll.timezone,
    );
    const conflicts = slotConflictsWithBusy(
      { start: new Date(slot.starts_at), end: new Date(slot.ends_at) },
      busy.intervals,
    );

    if (conflicts && !input.acknowledgeConflict) {
      return {
        status: 'conflict' as const,
        checkedGoogleCalendar: busy.checkedGoogle,
        mail: EMPTY_MAIL,
      };
    }

    const host = await loadHostIdentity(hostUserId);
    if (!host.email) {
      throw new Error(
        'Your account has no email address, so the calendar invite cannot be sent',
      );
    }

    const invitees = await this.listInvitees(poll.id);
    const { data: closed, error: closeError } = await table(
      this.client,
      'meeting_polls',
    )
      .update({
        status: 'closed',
        chosen_slot_id: slot.id,
        confirmed_at: new Date().toISOString(),
      })
      .eq('id', poll.id)
      .eq('account_id', input.accountId)
      .eq('status', 'open')
      .select('id')
      .maybeSingle();

    throwIfError(closeError, 'Could not close the poll');
    if (!closed) {
      throw new Error('This poll was already closed');
    }

    let written: {
      provider: 'google' | 'ozer';
      eventId: string;
      conferencingUrl: string | null;
    };

    try {
      written = await this.writeFinalEvent({
        poll,
        slot,
        hostUserId,
        host,
        invitees,
      });
    } catch (error) {
      const { error: reopenError } = await table(this.client, 'meeting_polls')
        .update({
          status: 'open',
          chosen_slot_id: null,
          confirmed_at: null,
          calendar_provider: null,
          calendar_event_id: null,
          conferencing_url: null,
        })
        .eq('id', poll.id)
        .eq('account_id', input.accountId)
        .eq('status', 'closed')
        .eq('chosen_slot_id', slot.id);

      if (reopenError) {
        throw new Error(
          'The calendar update failed and the poll could not be reopened. Check the poll before trying again.',
        );
      }

      throw error;
    }

    const { error: calendarError } = await table(this.client, 'meeting_polls')
      .update({
        calendar_provider: written.provider,
        calendar_event_id: written.eventId,
        conferencing_url: written.conferencingUrl,
      })
      .eq('id', poll.id)
      .eq('account_id', input.accountId)
      .eq('status', 'closed');

    throwIfError(
      calendarError,
      'The meeting was created, but the poll could not store the calendar link',
    );

    const mail = await sendPollConfirmationEmails({
      accountId: input.accountId,
      pollId: poll.id,
      title: poll.title,
      description: poll.description,
      location: poll.location,
      timezone: poll.timezone,
      startAt: slot.starts_at,
      endAt: slot.ends_at,
      conferencingUrl: written.conferencingUrl,
      organiserName: host.name,
      organiserEmail: host.email,
      invitees: invitees.map((invitee) => ({
        email: invitee.email,
        name: invitee.name,
      })),
    });

    return {
      status: 'confirmed' as const,
      calendarProvider: written.provider,
      checkedGoogleCalendar: busy.checkedGoogle,
      mail,
    };
  }

  async resendConfirmation(accountId: string, pollId: string) {
    const poll = await this.requirePoll(accountId, pollId);
    if (poll.status !== 'closed' || !poll.chosen_slot_id) {
      throw new Error('Confirm a time before resending the invite');
    }

    const slot = (await this.listSlots(poll.id)).find(
      (row) => row.id === poll.chosen_slot_id,
    );
    if (!slot) {
      throw new Error('The chosen time is missing');
    }

    const host = await loadHostIdentity(poll.host_user_id);
    if (!host.email) {
      throw new Error('Your account has no email address');
    }

    const invitees = await this.listInvitees(poll.id);
    return sendPollConfirmationEmails({
      accountId,
      pollId: poll.id,
      title: poll.title,
      description: poll.description,
      location: poll.location,
      timezone: poll.timezone,
      startAt: slot.starts_at,
      endAt: slot.ends_at,
      conferencingUrl: poll.conferencing_url,
      organiserName: host.name,
      organiserEmail: host.email,
      invitees: invitees.map((invitee) => ({
        email: invitee.email,
        name: invitee.name,
      })),
    });
  }

  async cancelPoll(accountId: string, pollId: string) {
    const poll = await this.requirePoll(accountId, pollId);
    if (poll.status === 'closed') {
      throw new Error('A confirmed poll cannot be cancelled here');
    }
    if (poll.status === 'cancelled') {
      return;
    }

    const { error } = await table(this.client, 'meeting_polls')
      .update({ status: 'cancelled' })
      .eq('id', poll.id)
      .eq('account_id', accountId)
      .in('status', ['draft', 'open']);

    throwIfError(error, 'Could not cancel the poll');
  }

  private async sendUnsentInvites(accountId: string, pollId: string) {
    const poll = await this.requirePoll(accountId, pollId);
    if (poll.status !== 'draft' && poll.status !== 'open') {
      throw new Error('Invites can only be sent for an open poll');
    }

    const pending = (await this.listInvitees(poll.id)).filter(
      (invitee) => !invitee.invited_at,
    );
    if (pending.length === 0) {
      if (poll.status === 'draft') {
        throw new Error('Add invitees before sending');
      }
      return EMPTY_MAIL;
    }

    if (poll.status === 'draft') {
      const { data, error } = await table(this.client, 'meeting_polls')
        .update({ status: 'open' })
        .eq('id', poll.id)
        .eq('status', 'draft')
        .select('id')
        .maybeSingle();
      throwIfError(error, 'Could not open the poll');
      if (!data) {
        throw new Error('This poll was already sent');
      }
    }

    const host = await loadHostIdentity(poll.host_user_id);
    const mail = await sendPollInviteEmails({
      accountId,
      pollId: poll.id,
      title: poll.title,
      description: poll.description,
      durationMinutes: poll.duration_minutes,
      organiserName: host.name,
      replyTo: host.email,
      invitees: pending.map((invitee) => ({
        email: invitee.email,
        name: invitee.name,
        token: invitee.token,
      })),
    });

    if (mail.sent.length > 0) {
      const sent = new Set(mail.sent.map((email) => email.toLowerCase()));
      const ids = pending
        .filter((invitee) => sent.has(invitee.email))
        .map((invitee) => invitee.id);

      if (ids.length > 0) {
        await table(this.client, 'meeting_poll_invitees')
          .update({ invited_at: new Date().toISOString() })
          .in('id', ids);
      }
    }

    return mail;
  }

  private async writeFinalEvent(input: {
    poll: PollRow;
    slot: SlotRow;
    hostUserId: string;
    host: { name: string; email: string | null };
    invitees: InviteeRow[];
  }): Promise<{
    provider: 'google' | 'ozer';
    eventId: string;
    conferencingUrl: string | null;
  }> {
    try {
      const created = await createGoogleBookingCalendarEvent({
        accountId: input.poll.account_id,
        hostUserId: input.hostUserId,
        summary: input.poll.title,
        description: [
          input.poll.description,
          'Scheduled from an Ozer meeting poll.',
        ]
          .filter(Boolean)
          .join('\n\n'),
        startAt: new Date(input.slot.starts_at),
        endAt: new Date(input.slot.ends_at),
        inviteeTimezone: input.poll.timezone,
        attendees: input.invitees.map((invitee) => ({
          email: invitee.email,
          name: invitee.name ?? undefined,
        })),
        createMeet: !input.poll.location,
        location: input.poll.location,
        sendUpdates: 'none',
      });

      return {
        provider: 'google',
        eventId: created.eventId,
        conferencingUrl: created.conferencingUrl ?? input.poll.location,
      };
    } catch (error) {
      if (error instanceof GoogleCalendarReconnectRequiredError) {
        throw new Error(
          'Google Calendar needs to be reconnected before this time can be booked. The poll is still open.',
        );
      }
      if (!(error instanceof GoogleCalendarNotConnectedError)) {
        throw new Error(
          error instanceof Error
            ? error.message
            : 'Google Calendar could not be updated. The poll is still open.',
        );
      }
    }

    const { data, error } = await table(this.client, 'account_calendar_events')
      .insert({
        account_id: input.poll.account_id,
        title: input.poll.title,
        starts_at: input.slot.starts_at,
        ends_at: input.slot.ends_at,
        location: input.poll.location,
        created_by: input.hostUserId,
      })
      .select('id')
      .single();

    throwIfError(error, 'Could not save the meeting on your Ozer calendar');

    return {
      provider: 'ozer',
      eventId: String((data as { id: string }).id),
      conferencingUrl: input.poll.location,
    };
  }

  private async loadOrganiserBusy(
    accountId: string,
    hostUserId: string,
    from: Date,
    to: Date,
    timeZone: string,
  ) {
    const intervals: Array<{ start: Date; end: Date }> = [];
    let checkedGoogle = false;

    try {
      const busy = await getBusyIntervals(accountId, from, to, {
        hostUserId,
        timeZone,
      });
      intervals.push(...busy);
      checkedGoogle = true;
    } catch (error) {
      if (
        !(error instanceof GoogleCalendarNotConnectedError) &&
        !(error instanceof GoogleCalendarReconnectRequiredError)
      ) {
        checkedGoogle = false;
      }
    }

    const { data: pages } = await table(this.client, 'booking_pages')
      .select('id')
      .eq('account_id', accountId)
      .eq('host_user_id', hostUserId);

    const pageIds = ((pages ?? []) as Array<{ id: string }>).map(
      (page) => page.id,
    );
    if (pageIds.length > 0) {
      const { data: bookings } = await table(this.client, 'bookings')
        .select('start_at, end_at')
        .eq('account_id', accountId)
        .eq('status', 'confirmed')
        .in('booking_page_id', pageIds)
        .lt('start_at', to.toISOString())
        .gt('end_at', from.toISOString());

      for (const booking of (bookings ?? []) as Array<{
        start_at: string;
        end_at: string;
      }>) {
        intervals.push({
          start: new Date(booking.start_at),
          end: new Date(booking.end_at),
        });
      }
    }

    const { data: events } = await table(this.client, 'account_calendar_events')
      .select('starts_at, ends_at')
      .eq('account_id', accountId)
      .gte('starts_at', new Date(from.getTime() - 86_400_000).toISOString())
      .lt('starts_at', to.toISOString());

    for (const event of (events ?? []) as Array<{
      starts_at: string;
      ends_at: string | null;
    }>) {
      const start = new Date(event.starts_at);
      const end = event.ends_at
        ? new Date(event.ends_at)
        : new Date(start.getTime() + 60 * 60_000);
      if (end > from && start < to) {
        intervals.push({ start, end });
      }
    }

    return { intervals, checkedGoogle };
  }

  private async loadWorkingHours(accountId: string) {
    const { data: schedules, error } = await table(
      this.client,
      'availability_schedules',
    )
      .select('id, timezone, is_default')
      .eq('account_id', accountId);

    throwIfError(error, 'Could not load availability');

    const rows = (schedules ?? []) as Array<{
      id: string;
      timezone: string;
      is_default: boolean;
    }>;
    const schedule = rows.find((row) => row.is_default) ?? rows[0];

    if (!schedule) {
      return {
        source: 'default' as const,
        rules: WEEKDAY_WORKING_HOURS,
        overrides: [],
      };
    }

    const [{ data: rules }, { data: overrides }] = await Promise.all([
      table(this.client, 'availability_rules')
        .select('day_of_week, start_time, end_time')
        .eq('schedule_id', schedule.id),
      table(this.client, 'availability_overrides')
        .select('date, start_time, end_time')
        .eq('schedule_id', schedule.id),
    ]);

    return {
      source: 'schedule' as const,
      rules: ((rules ?? []) as Array<Record<string, unknown>>).map((rule) => ({
        dayOfWeek: Number(rule.day_of_week),
        startTime: String(rule.start_time).slice(0, 5),
        endTime: String(rule.end_time).slice(0, 5),
      })),
      overrides: ((overrides ?? []) as Array<Record<string, unknown>>).map(
        (override) => ({
          date: String(override.date).slice(0, 10),
          startTime: override.start_time
            ? String(override.start_time).slice(0, 5)
            : null,
          endTime: override.end_time
            ? String(override.end_time).slice(0, 5)
            : null,
        }),
      ),
    };
  }

  private async replaceDraftChildren(
    pollId: string,
    slots: Array<{
      starts_at: string;
      ends_at: string;
      source: 'suggested' | 'manual';
    }>,
    invitees: Array<{
      email: string;
      name: string | null;
      contact_id: string | null;
    }>,
  ) {
    const { error: deleteInviteesError } = await table(
      this.client,
      'meeting_poll_invitees',
    )
      .delete()
      .eq('poll_id', pollId);
    throwIfError(deleteInviteesError, 'Could not update invitees');

    const { error: deleteSlotsError } = await table(
      this.client,
      'meeting_poll_slots',
    )
      .delete()
      .eq('poll_id', pollId);
    throwIfError(deleteSlotsError, 'Could not update times');

    const { error: slotError } = await table(
      this.client,
      'meeting_poll_slots',
    ).insert(slots.map((slot) => ({ ...slot, poll_id: pollId })));
    throwIfError(slotError, 'Could not save times');

    const { error: inviteeError } = await table(
      this.client,
      'meeting_poll_invitees',
    ).insert(
      invitees.map((invitee) => ({
        ...invitee,
        poll_id: pollId,
        token: randomBytes(32).toString('hex'),
      })),
    );
    throwIfError(inviteeError, 'Could not save invitees');
  }

  private async requirePoll(accountId: string, pollId: string) {
    const { data, error } = await table(this.client, 'meeting_polls')
      .select('*')
      .eq('account_id', accountId)
      .eq('id', pollId)
      .maybeSingle();

    throwIfError(error, 'Could not load the poll');
    if (!data) {
      throw new Error('Poll not found');
    }

    return data as PollRow;
  }

  private async listSlots(pollId: string) {
    const { data, error } = await table(this.client, 'meeting_poll_slots')
      .select('id, starts_at, ends_at, source')
      .eq('poll_id', pollId)
      .order('starts_at', { ascending: true });
    throwIfError(error, 'Could not load times');
    return (data ?? []) as SlotRow[];
  }

  private async listInvitees(pollId: string) {
    const { data, error } = await table(this.client, 'meeting_poll_invitees')
      .select(
        'id, email, name, contact_id, token, responded_at, invited_at, last_reminded_at',
      )
      .eq('poll_id', pollId)
      .order('created_at', { ascending: true });
    throwIfError(error, 'Could not load invitees');
    return (data ?? []) as InviteeRow[];
  }

  private async listResponses(pollId: string) {
    const invitees = await this.listInvitees(pollId);
    if (invitees.length === 0) {
      return [] as Array<{
        slotId: string;
        inviteeId: string;
        answer: PollVote;
      }>;
    }

    const { data, error } = await table(this.client, 'meeting_poll_responses')
      .select('invitee_id, slot_id, answer')
      .in(
        'invitee_id',
        invitees.map((invitee) => invitee.id),
      );
    throwIfError(error, 'Could not load responses');

    return (
      (data ?? []) as Array<{
        invitee_id: string;
        slot_id: string;
        answer: PollVote;
      }>
    ).map((row) => ({
      inviteeId: row.invitee_id,
      slotId: row.slot_id,
      answer: row.answer,
    }));
  }

  private async loadLinkLabels(
    accountId: string,
    clientId: string | null,
    projectId: string | null,
  ) {
    let clientLabel: string | null = null;
    let projectLabel: string | null = null;

    if (clientId) {
      const { data } = await table(this.client, 'clients')
        .select('display_name, company_name')
        .eq('account_id', accountId)
        .eq('id', clientId)
        .maybeSingle();
      const row = data as {
        display_name?: string | null;
        company_name?: string | null;
      } | null;
      clientLabel =
        row?.display_name?.trim() || row?.company_name?.trim() || null;
    }

    if (projectId) {
      const { data } = await table(this.client, 'projects')
        .select('name')
        .eq('account_id', accountId)
        .eq('id', projectId)
        .maybeSingle();
      projectLabel = ((data as { name?: string } | null)?.name ?? null) || null;
    }

    return { clientLabel, projectLabel };
  }

  private async assertLinks(
    accountId: string,
    clientId?: string | null,
    projectId?: string | null,
  ) {
    if (clientId) {
      const { data, error } = await table(this.client, 'clients')
        .select('id')
        .eq('account_id', accountId)
        .eq('id', clientId)
        .maybeSingle();
      throwIfError(error, 'Could not load the client');
      if (!data) throw new Error('Client not found');
    }

    if (projectId) {
      const { data, error } = await table(this.client, 'projects')
        .select('id')
        .eq('account_id', accountId)
        .eq('id', projectId)
        .maybeSingle();
      throwIfError(error, 'Could not load the project');
      if (!data) throw new Error('Project not found');
    }
  }

  private async normaliseInvitees(
    accountId: string,
    invitees: Array<{
      email: string;
      name?: string | null;
      contactId?: string | null;
    }>,
  ) {
    const byEmail = new Map<
      string,
      { email: string; name: string | null; contact_id: string | null }
    >();

    for (const invitee of invitees) {
      const email = invitee.email.trim().toLowerCase();
      byEmail.set(email, {
        email,
        name: invitee.name?.trim() || null,
        contact_id: invitee.contactId ?? null,
      });
    }

    const contactIds = [...byEmail.values()]
      .map((invitee) => invitee.contact_id)
      .filter((id): id is string => Boolean(id));

    if (contactIds.length > 0) {
      const { data } = await table(this.client, 'contacts')
        .select('id')
        .eq('account_id', accountId)
        .in('id', contactIds);
      const allowed = new Set(
        ((data ?? []) as Array<{ id: string }>).map((row) => row.id),
      );
      for (const invitee of byEmail.values()) {
        if (invitee.contact_id && !allowed.has(invitee.contact_id)) {
          invitee.contact_id = null;
        }
      }
    }

    return [...byEmail.values()];
  }
}

function normaliseSlots(
  slots: Array<{ startAtIso: string; source: 'suggested' | 'manual' }>,
  durationMinutes: number,
  options?: { requireFuture?: boolean },
) {
  const seen = new Set<string>();
  const next = [];

  for (const slot of slots) {
    const start = new Date(slot.startAtIso);
    if (!Number.isFinite(start.getTime())) {
      throw new Error('One of the times is invalid');
    }
    if (options?.requireFuture && start.getTime() < Date.now() - 60_000) {
      throw new Error('Times must be in the future');
    }
    const startsAt = start.toISOString();
    if (seen.has(startsAt)) continue;
    seen.add(startsAt);
    next.push({
      starts_at: startsAt,
      ends_at: new Date(
        start.getTime() + durationMinutes * 60_000,
      ).toISOString(),
      source: slot.source,
    });
  }

  if (next.length === 0) {
    throw new Error('Add at least one time');
  }

  return next.sort((left, right) =>
    left.starts_at.localeCompare(right.starts_at),
  );
}

function assertTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone }).format(new Date());
  } catch {
    throw new Error('Choose a valid timezone');
  }
}

function assertRange(start: string, end: string) {
  if (end < start) {
    throw new Error('The end date must be on or after the start date');
  }
  const span =
    (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) /
    86_400_000;
  if (span > 62) {
    throw new Error('Choose a date range of 62 days or less');
  }
}

function blankToNull(value?: string | null) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

async function loadHostIdentity(hostUserId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.auth.admin.getUserById(hostUserId);
  if (error || !data.user) {
    return { name: '', email: null as string | null };
  }

  const metadata = data.user.user_metadata as
    | { full_name?: string; name?: string }
    | undefined;
  const name = metadata?.full_name?.trim() || metadata?.name?.trim() || '';

  return { name, email: data.user.email ?? null };
}
