import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type PollVote,
  type PublicPollView,
  buildPublicPollView,
  isPollInviteToken,
  rankPollSlots,
} from '@kit/scheduling/polls';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadHostIdentity } from '~/home/[account]/scheduling/_lib/server/meeting-polls.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { sendPollResponseNotificationEmail } from '~/lib/scheduling/meeting-polls/emails';

function table(client: unknown, name: string) {
  return (
    client as {
      from: (tableName: string) => ReturnType<SupabaseClient['from']>;
    }
  ).from(name);
}

export type PublicPollPage =
  | { status: 'not_found' }
  | (Extract<PublicPollView, { status: 'ok' }> & {
      brandName: string;
      logoUrl: string | null;
      primaryColor: string;
    });

/**
 * Loads one poll for one invitee token. The admin client is used only after
 * the token matches a single invitee row.
 */
export async function loadPublicPollPage(
  token: string,
): Promise<PublicPollPage> {
  if (!isPollInviteToken(token)) {
    return { status: 'not_found' };
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invitee, error } = await table(admin, 'meeting_poll_invitees')
    .select('id, poll_id, token, name, email')
    .eq('token', token)
    .maybeSingle();

  if (error || !invitee) {
    return { status: 'not_found' };
  }

  const inviteeRow = invitee as {
    id: string;
    poll_id: string;
    token: string;
    name: string | null;
    email: string;
  };

  const { data: poll, error: pollError } = await table(admin, 'meeting_polls')
    .select(
      'id, account_id, title, description, location, duration_minutes, timezone, show_voter_names, status, chosen_slot_id, conferencing_url',
    )
    .eq('id', inviteeRow.poll_id)
    .maybeSingle();

  if (pollError || !poll) {
    return { status: 'not_found' };
  }

  const pollRow = poll as {
    id: string;
    account_id: string;
    title: string;
    description: string | null;
    location: string | null;
    duration_minutes: number;
    timezone: string;
    show_voter_names: boolean;
    status: 'draft' | 'open' | 'closed' | 'cancelled';
    chosen_slot_id: string | null;
    conferencing_url: string | null;
  };

  const [{ data: slots }, { data: invitees }] = await Promise.all([
    table(admin, 'meeting_poll_slots')
      .select('id, starts_at, ends_at')
      .eq('poll_id', pollRow.id)
      .order('starts_at', { ascending: true }),
    table(admin, 'meeting_poll_invitees')
      .select('id, name, email')
      .eq('poll_id', pollRow.id),
  ]);

  const inviteeRows = (invitees ?? []) as Array<{
    id: string;
    name: string | null;
    email: string;
  }>;
  const slotRows = (slots ?? []) as Array<{
    id: string;
    starts_at: string;
    ends_at: string;
  }>;

  const { data: responses } =
    inviteeRows.length === 0
      ? { data: [] }
      : await table(admin, 'meeting_poll_responses')
          .select('invitee_id, slot_id, answer')
          .in(
            'invitee_id',
            inviteeRows.map((row) => row.id),
          );

  const view = buildPublicPollView({
    token,
    poll: {
      id: pollRow.id,
      status: pollRow.status,
      title: pollRow.title,
      description: pollRow.description,
      location: pollRow.location,
      durationMinutes: pollRow.duration_minutes,
      timezone: pollRow.timezone,
      showVoterNames: pollRow.show_voter_names,
      chosenSlotId: pollRow.chosen_slot_id,
      conferencingUrl: pollRow.conferencing_url,
    },
    invitee: {
      id: inviteeRow.id,
      pollId: inviteeRow.poll_id,
      token: inviteeRow.token,
      name: inviteeRow.name,
      email: inviteeRow.email,
    },
    slots: slotRows.map((slot) => ({
      id: slot.id,
      startsAt: slot.starts_at,
      endsAt: slot.ends_at,
    })),
    invitees: inviteeRows,
    responses: (
      (responses ?? []) as Array<{
        invitee_id: string;
        slot_id: string;
        answer: PollVote;
      }>
    ).map((row) => ({
      inviteeId: row.invitee_id,
      slotId: row.slot_id,
      answer: row.answer,
    })),
  });

  if (view.status !== 'ok') {
    return { status: 'not_found' };
  }

  const [{ data: account }, brand] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', pollRow.account_id)
      .maybeSingle(),
    loadAccountBrandResolved(pollRow.account_id),
  ]);

  return {
    ...view,
    brandName: account?.name?.trim() || 'Ozer',
    logoUrl: brand.logo_url,
    primaryColor: safeColor(brand.primary_color),
  };
}

export async function submitPublicPollVote(input: {
  token: string;
  name: string;
  answers: Array<{ slotId: string; answer: PollVote }>;
}) {
  const page = await loadPublicPollPage(input.token);
  if (page.status !== 'ok' || !page.canVote) {
    throw new Error('This poll is not open for voting');
  }

  const expected = new Set(page.slots.map((slot) => slot.id));
  const seen = new Set<string>();

  for (const answer of input.answers) {
    if (!expected.has(answer.slotId) || seen.has(answer.slotId)) {
      throw new Error('Those times do not match this poll');
    }
    seen.add(answer.slotId);
  }

  const admin = getSupabaseServerAdminClient();
  const { data: invitee, error } = await table(admin, 'meeting_poll_invitees')
    .select('id, poll_id')
    .eq('token', input.token)
    .maybeSingle();

  if (error || !invitee) {
    throw new Error('This link is not valid');
  }

  const inviteeRow = invitee as { id: string; poll_id: string };
  const { data: openPoll } = await table(admin, 'meeting_polls')
    .select('status')
    .eq('id', inviteeRow.poll_id)
    .maybeSingle();

  if ((openPoll as { status?: string } | null)?.status !== 'open') {
    throw new Error('This poll is not open for voting');
  }

  const inviteeId = inviteeRow.id;
  const slotIds = [...expected];
  const wasComplete = await countAnswered(admin, inviteeId, slotIds).then(
    (count) => count === slotIds.length,
  );

  const rows = input.answers.map((answer) => ({
    invitee_id: inviteeId,
    slot_id: answer.slotId,
    answer: answer.answer,
  }));

  const { error: upsertError } = await table(
    admin,
    'meeting_poll_responses',
  ).upsert(rows, { onConflict: 'invitee_id,slot_id' });

  if (upsertError) {
    throw new Error(upsertError.message || 'Could not save your response');
  }

  const { error: nameError } = await table(admin, 'meeting_poll_invitees')
    .update({
      name: input.name.trim(),
    })
    .eq('id', inviteeId)
    .eq('token', input.token);

  if (nameError) {
    throw new Error(nameError.message || 'Could not save your name');
  }

  const answered = await countAnswered(admin, inviteeId, slotIds);
  const complete = answered === slotIds.length;

  if (complete && !wasComplete) {
    // A failed organiser email must never fail the voter's save.
    try {
      await notifyOrganiser({
        pollId: inviteeRow.poll_id,
        responderName: input.name.trim(),
      });
    } catch (error) {
      console.error('[meeting-poll] organiser notification failed', error);
    }
  }

  return { answered, total: slotIds.length, complete };
}

async function countAnswered(
  admin: unknown,
  inviteeId: string,
  slotIds: string[],
) {
  const { data } = await table(admin, 'meeting_poll_responses')
    .select('slot_id')
    .eq('invitee_id', inviteeId)
    .in('slot_id', slotIds);

  return (data ?? []).length;
}

async function notifyOrganiser(input: {
  pollId: string;
  responderName: string;
}) {
  const admin = getSupabaseServerAdminClient();
  const { data: poll } = await table(admin, 'meeting_polls')
    .select('id, account_id, title, timezone, host_user_id')
    .eq('id', input.pollId)
    .maybeSingle();

  const pollRow = poll as {
    id: string;
    account_id: string;
    title: string;
    timezone: string;
    host_user_id: string;
  } | null;
  if (!pollRow) return;

  const [{ data: slots }, { data: invitees }, { data: account }, host] =
    await Promise.all([
      table(admin, 'meeting_poll_slots')
        .select('id, starts_at')
        .eq('poll_id', pollRow.id),
      table(admin, 'meeting_poll_invitees')
        .select('id')
        .eq('poll_id', pollRow.id),
      admin
        .from('accounts')
        .select('slug')
        .eq('id', pollRow.account_id)
        .maybeSingle(),
      loadHostIdentity(pollRow.host_user_id),
    ]);

  if (!host.email || !account?.slug) return;

  const slotRows = (slots ?? []) as Array<{ id: string; starts_at: string }>;
  const inviteeIds = ((invitees ?? []) as Array<{ id: string }>).map(
    (row) => row.id,
  );
  if (inviteeIds.length === 0 || slotRows.length === 0) return;

  const { data: responses } = await table(admin, 'meeting_poll_responses')
    .select('invitee_id, slot_id, answer')
    .in('invitee_id', inviteeIds);

  const responseRows = (
    (responses ?? []) as Array<{
      invitee_id: string;
      slot_id: string;
      answer: PollVote;
    }>
  ).map((row) => ({
    inviteeId: row.invitee_id,
    slotId: row.slot_id,
    answer: row.answer,
  }));

  const perInvitee = new Map<string, number>();
  for (const row of responseRows) {
    perInvitee.set(row.inviteeId, (perInvitee.get(row.inviteeId) ?? 0) + 1);
  }
  const completedCount = inviteeIds.filter(
    (id) => (perInvitee.get(id) ?? 0) >= slotRows.length,
  ).length;

  const ranked = rankPollSlots({
    slots: slotRows.map((slot) => ({ id: slot.id, startsAt: slot.starts_at })),
    responses: responseRows,
    inviteeIds,
  }).slice(0, 3);

  const siteUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    'https://app.ozer.so';

  await sendPollResponseNotificationEmail({
    accountId: pollRow.account_id,
    pollId: pollRow.id,
    title: pollRow.title,
    timezone: pollRow.timezone,
    hostEmail: host.email,
    hostName: host.name,
    responderName: input.responderName,
    completedCount,
    totalInvitees: inviteeIds.length,
    bestSlots: ranked.map((slot) => ({
      startsAt: slot.startsAt,
      yes: slot.yes,
      ifNeedBe: slot.ifNeedBe,
      no: slot.no,
    })),
    pollUrl: `${siteUrl}/app/${account.slug}/scheduling/polls/${pollRow.id}`,
  });
}

function safeColor(value: string) {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : '#0D2344';
}
