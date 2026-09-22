'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadAccountBranches } from '~/lib/brand/account-branches';
import {
  type BoardNotifyStatus,
  applyBoardTemplate,
  boardStatusLabel,
  dedupeBoardEmails,
  formatBoardListingRef,
  formatBoardPropertyAddress,
  isValidBoardEmail,
  parseCcList,
  resolveBoardRecipients,
} from '~/lib/commercial/board-company-settings';
import { loadCommercialBoardSettings } from '~/lib/commercial/board-company-settings.server';
import { recordListingEvent } from '~/lib/commercial/listing-events';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';
import { sendClientFacingEmail } from '~/lib/server/send-client-facing-email';

import {
  PrepareBoardNotifySchema,
  SendBoardNotifySchema,
  SkipBoardNotifySchema,
} from '../schema/board-notify.schema';
import { createListingsService } from './listings.service';

function actorDisplayName(user: {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
}): string {
  const meta = user.user_metadata ?? {};
  const first =
    typeof meta.first_name === 'string' ? meta.first_name.trim() : '';
  const last = typeof meta.last_name === 'string' ? meta.last_name.trim() : '';
  const full = [first, last].filter(Boolean).join(' ');
  if (full) return full;
  if (typeof meta.display_name === 'string' && meta.display_name.trim()) {
    return meta.display_name.trim();
  }
  if (typeof meta.full_name === 'string' && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  return user.email?.trim() || 'Agent';
}

export type BoardNotifyPreview = {
  to: string;
  cc: string;
  subject: string;
  body: string;
  configured: boolean;
  settingsHref: string | null;
  statusLabel: string;
  propertyAddress: string;
};

export const prepareBoardNotifyAction = enhanceAction(
  async (input): Promise<BoardNotifyPreview> => {
    await requireCommercialBillableActor(
      input.accountId,
      'prepare board company notify',
    );

    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const listing = await createListingsService(client).getListing(
      input.listingId,
      input.accountId,
    );
    if (!listing) throw new Error('Disposal not found');

    const [settings, branches] = await Promise.all([
      loadCommercialBoardSettings(client, input.accountId),
      loadAccountBranches(input.accountId),
    ]);

    const branch =
      branches.find((b) => b.id === listing.accountBranchId) ??
      branches.find((b) => b.isDefault) ??
      null;

    const recipients = resolveBoardRecipients(
      settings,
      listing.accountBranchId,
    );
    const propertyAddress = formatBoardPropertyAddress(listing);
    const listingRef = formatBoardListingRef(listing);
    const statusLabel = boardStatusLabel(input.status);
    const agentName =
      listing.actingAgents?.[0]?.name?.trim() || actorDisplayName(user);
    const merge = {
      propertyAddress,
      status: statusLabel,
      listingRef,
      branchName: branch?.name?.trim() || '—',
      agentName,
    };

    const settingsHref = input.accountSlug
      ? pathsConfig.app.accountCommercialPublishing.replace(
          '[account]',
          input.accountSlug,
        ) + '#board-company'
      : null;

    return {
      to: recipients.email,
      cc: recipients.cc,
      subject: applyBoardTemplate(settings.subjectTemplate, merge),
      body: applyBoardTemplate(settings.bodyTemplate, merge),
      configured: Boolean(recipients.email),
      settingsHref,
      statusLabel,
      propertyAddress,
    };
  },
  { schema: PrepareBoardNotifySchema },
);

export const sendBoardNotifyAction = enhanceAction(
  async (input) => {
    await requireCommercialBillableActor(
      input.accountId,
      'notify board company',
    );

    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const listing = await createListingsService(client).getListing(
      input.listingId,
      input.accountId,
    );
    if (!listing) throw new Error('Disposal not found');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: account } = await (client as any)
      .from('accounts')
      .select('name')
      .eq('id', input.accountId)
      .maybeSingle();

    const accountName =
      (account as { name?: string | null } | null)?.name?.trim() || 'Agency';
    const statusLabel = boardStatusLabel(input.status as BoardNotifyStatus);
    const recipients = dedupeBoardEmails(input.to);
    if (recipients.length === 0) {
      throw new Error('Add at least one recipient');
    }

    const ccList = dedupeBoardEmails(parseCcList(input.cc ?? '')).filter(
      (email) =>
        !recipients.some(
          (recipient) => recipient.toLowerCase() === email.toLowerCase(),
        ),
    );
    const invalidCc = ccList.filter((email) => !isValidBoardEmail(email));
    if (invalidCc.length > 0) {
      throw new Error(`Enter a valid CC email: ${invalidCc.join(', ')}`);
    }

    const subject = input.subject.trim();
    const body = input.body.trim();

    // The agency mailer delivers one To address per send.
    for (const [index, to] of recipients.entries()) {
      await sendClientFacingEmail({
        type: 'commercial_board_notify',
        accountId: input.accountId,
        feature: 'other',
        accountName,
        displayName: accountName,
        mail: {
          to,
          subject,
          text: body,
          ...(index === 0 && ccList.length > 0 ? { cc: ccList } : {}),
        },
        metadata: {
          listing_id: input.listingId,
          board_status: input.status,
          recipient_index: index,
          recipient_count: recipients.length,
        },
      });
    }

    await recordListingEvent(client, {
      accountId: input.accountId,
      listingId: input.listingId,
      actorUserId: user.id,
      eventType: 'board_notify_sent',
      summary: `Board company notified (${statusLabel})`,
      metadata: {
        status: input.status,
        to: recipients,
        cc: ccList,
      },
    });

    return { ok: true as const };
  },
  { schema: SendBoardNotifySchema },
);

export const skipBoardNotifyAction = enhanceAction(
  async (input) => {
    await requireCommercialBillableActor(
      input.accountId,
      'skip board company notify',
    );

    const client = getSupabaseServerClient();
    const {
      data: { user },
    } = await client.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const statusLabel = boardStatusLabel(input.status as BoardNotifyStatus);

    await recordListingEvent(client, {
      accountId: input.accountId,
      listingId: input.listingId,
      actorUserId: user.id,
      eventType: 'board_notify_skipped',
      summary: `Board company notify skipped (${statusLabel})`,
      metadata: { status: input.status },
    });

    return { ok: true as const };
  },
  { schema: SkipBoardNotifySchema },
);
