'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import {
  assertIgManagePermission,
  assertInstagramAutoreplyAccess,
} from '~/lib/instagram-autoreply/assert-access';
import { sendIgMessage } from '~/lib/instagram-autoreply/graph-api';
import {
  claimOutboundSend,
  markOutboundFailed,
  markOutboundSent,
} from '~/lib/instagram-autoreply/sequence/message-events';
import { isWithinMessagingWindow } from '~/lib/instagram-autoreply/sequence/window';
import { decryptIgToken } from '~/lib/instagram-autoreply/token-crypto';
import type {
  IgConnectedAccountRow,
  IgContactRow,
} from '~/lib/instagram-autoreply/types';

import {
  igContactActionSchema,
  sendIgAgentReplyActionSchema,
} from '../schema/instagram-autoreply.schema';

function revalidateInbox(slug: string) {
  revalidatePath(
    pathsConfig.app.accountInstagramAutoreplyInbox.replace('[account]', slug),
  );
}

async function loadContactForAccount(accountId: string, contactId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('ig_contacts')
    .select('*')
    .eq('id', contactId)
    .eq('account_id', accountId)
    .maybeSingle();
  if (!data) throw new Error('Conversation not found');
  return { admin, contact: data as IgContactRow };
}

/** A staff reply typed in the inbox, sent within the 24-hour window. */
export const sendIgAgentReply = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );
    await assertIgManagePermission(client, input.accountId, user.id);
    const { admin, contact } = await loadContactForAccount(
      input.accountId,
      input.contactId,
    );

    if (contact.opted_out_at) {
      throw new Error('This person has opted out of messages');
    }
    if (!isWithinMessagingWindow(contact.last_inbound_at)) {
      throw new Error(
        'Instagram only allows replies within 24 hours of their last message. You can reply again once they message you.',
      );
    }

    const { data: igAccountRow } = await admin
      .from('ig_connected_accounts')
      .select('*')
      .eq('id', contact.ig_account_id)
      .eq('is_active', true)
      .maybeSingle();
    if (!igAccountRow) throw new Error('Reconnect Instagram to reply');
    const igAccount = igAccountRow as IgConnectedAccountRow;

    const claim = await claimOutboundSend(
      admin,
      {
        accountId: input.accountId,
        igAccountId: igAccount.id,
        contactId: contact.id,
      },
      {
        idempotencyKey: `agent:${user.id}:${contact.id}:${input.nonce}`,
        eventType: 'agent',
        body: input.text,
        agentUserId: user.id,
      },
    );
    if (claim.kind === 'already_sent') {
      revalidateInbox(slug);
      return { ok: true };
    }
    if (claim.kind !== 'claimed') throw new Error('Could not send, try again');

    try {
      const result = await sendIgMessage(
        igAccount.ig_business_account_id,
        decryptIgToken(igAccount.access_token),
        { recipient: { id: contact.igsid }, message: { text: input.text } },
      );
      await markOutboundSent(admin, claim.eventId, result.messageId);
    } catch (error) {
      await markOutboundFailed(admin, claim.eventId, error);
      throw new Error(
        'Instagram did not accept the message. Try again shortly.',
      );
    }

    revalidateInbox(slug);
    return { ok: true };
  },
  { schema: sendIgAgentReplyActionSchema },
);

/**
 * Take over a conversation (pauses automations for this person) or hand it
 * back so automations can reply again.
 */
export const setIgConversationHandoff = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );
    await assertIgManagePermission(client, input.accountId, user.id);
    const { admin, contact } = await loadContactForAccount(
      input.accountId,
      input.contactId,
    );

    const { error } = await admin
      .from('ig_contacts')
      .update({ handoff_at: input.handedOff ? new Date().toISOString() : null })
      .eq('id', contact.id);
    if (error) throw new Error(error.message);

    revalidateInbox(slug);
    return { ok: true };
  },
  {
    schema: igContactActionSchema.extend({ handedOff: z.boolean() }),
  },
);
