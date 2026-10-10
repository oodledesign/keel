import 'server-only';

import { cache } from 'react';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type PollResultsView,
  type PollVote,
  buildPollResultsView,
  isPollInviteToken,
} from '@kit/scheduling/polls';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadHostIdentity } from '~/home/[account]/scheduling/_lib/server/meeting-polls.service';
import { loadAccountBrandResolved } from '~/lib/brand/account-brand';
import { type BrandFonts, brandFontsOf } from '~/lib/brand/brand-fonts.shared';

function table(client: unknown, name: string) {
  return (
    client as {
      from: (tableName: string) => ReturnType<SupabaseClient['from']>;
    }
  ).from(name);
}

export type PublicPollResultsPage =
  | { status: 'not_found' }
  | (Extract<PollResultsView, { status: 'ok' }> & {
      brandName: string;
      logoUrl: string | null;
      primaryColor: string;
      fonts: BrandFonts;
      organiserName: string;
      organiserEmail: string | null;
    });

/**
 * Loads the view-only results for one results token. The admin client is
 * used only after the token matches a single poll.
 */
export const loadPublicPollResultsPage = cache(
  async function loadPublicPollResultsPage(
    token: string,
  ): Promise<PublicPollResultsPage> {
    if (!isPollInviteToken(token)) {
      return { status: 'not_found' };
    }

    const admin = getSupabaseServerAdminClient();
    const { data: poll, error } = await table(admin, 'meeting_polls')
      .select(
        'id, account_id, host_user_id, title, description, location, duration_minutes, timezone, status, chosen_slot_id, conferencing_url, results_token',
      )
      .eq('results_token', token)
      .maybeSingle();

    if (error || !poll) {
      return { status: 'not_found' };
    }

    const pollRow = poll as {
      id: string;
      account_id: string;
      host_user_id: string;
      title: string;
      description: string | null;
      location: string | null;
      duration_minutes: number;
      timezone: string;
      status: 'draft' | 'open' | 'closed' | 'cancelled';
      chosen_slot_id: string | null;
      conferencing_url: string | null;
      results_token: string | null;
    };

    const [{ data: slots }, { data: invitees }] = await Promise.all([
      table(admin, 'meeting_poll_slots')
        .select('id, starts_at, ends_at')
        .eq('poll_id', pollRow.id)
        .order('starts_at', { ascending: true }),
      table(admin, 'meeting_poll_invitees')
        .select('id, name, email')
        .eq('poll_id', pollRow.id)
        .order('created_at', { ascending: true }),
    ]);

    const inviteeRows = (invitees ?? []) as Array<{
      id: string;
      name: string | null;
      email: string;
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

    const view = buildPollResultsView({
      token,
      poll: {
        id: pollRow.id,
        status: pollRow.status,
        title: pollRow.title,
        description: pollRow.description,
        location: pollRow.location,
        durationMinutes: pollRow.duration_minutes,
        timezone: pollRow.timezone,
        chosenSlotId: pollRow.chosen_slot_id,
        conferencingUrl: pollRow.conferencing_url,
        resultsToken: pollRow.results_token,
      },
      slots: (
        (slots ?? []) as Array<{
          id: string;
          starts_at: string;
          ends_at: string;
        }>
      ).map((slot) => ({
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

    const [{ data: account }, brand, host] = await Promise.all([
      admin
        .from('accounts')
        .select('name')
        .eq('id', pollRow.account_id)
        .maybeSingle(),
      loadAccountBrandResolved(pollRow.account_id),
      loadHostIdentity(pollRow.host_user_id),
    ]);

    const brandName = account?.name?.trim() || 'Ozer';

    return {
      ...view,
      brandName,
      logoUrl: brand.logo_url,
      primaryColor: safeColor(brand.primary_color),
      fonts: brandFontsOf(brand),
      organiserName: host.name?.trim() || brandName,
      organiserEmail: host.email ?? null,
    };
  },
);

function safeColor(value: string) {
  return /^#[0-9A-Fa-f]{3,8}$/.test(value) ? value : '#0D2344';
}
