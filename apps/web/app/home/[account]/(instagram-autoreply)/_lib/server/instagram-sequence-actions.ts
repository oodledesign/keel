'use server';

import { revalidatePath } from 'next/cache';

import { randomUUID } from 'crypto';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import pathsConfig from '~/config/paths.config';
import { assertIgAutomationAllowed } from '~/lib/billing/entitlements';
import {
  assertIgManagePermission,
  assertInstagramAutoreplyAccess,
} from '~/lib/instagram-autoreply/assert-access';
import {
  type IgMediaItem,
  listIgMedia,
} from '~/lib/instagram-autoreply/graph-api';
import { startIgRun } from '~/lib/instagram-autoreply/sequence/start-run';
import { isMediaStep } from '~/lib/instagram-autoreply/sequence/step-types';
import { isWithinMessagingWindow } from '~/lib/instagram-autoreply/sequence/window';
import { decryptIgToken } from '~/lib/instagram-autoreply/token-crypto';
import type {
  IgConnectedAccountRow,
  IgContactRow,
  IgTriggerFullRow,
} from '~/lib/instagram-autoreply/types';

import {
  saveIgAutomationActionSchema,
  sendIgTestRunActionSchema,
} from '../schema/instagram-autoreply.schema';

function revalidateAutomationPaths(slug: string, triggerId?: string) {
  revalidatePath(
    pathsConfig.app.accountInstagramAutoreplyTriggers.replace(
      '[account]',
      slug,
    ),
  );
  if (triggerId) {
    revalidatePath(
      `${pathsConfig.app.accountInstagramAutoreplyTriggers.replace('[account]', slug)}/${triggerId}`,
    );
  }
}

export const saveIgAutomation = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { data: igAccount } = await client
      .from('ig_connected_accounts')
      .select('id')
      .eq('account_id', input.accountId)
      .eq('is_active', true)
      .maybeSingle();
    if (!igAccount) {
      throw new Error(
        'Connect an Instagram account before creating automations',
      );
    }

    const assetIds = [
      ...new Set(
        input.steps.flatMap((s) =>
          isMediaStep(s) && s.asset_id ? [s.asset_id] : [],
        ),
      ),
    ];
    if (assetIds.length > 0) {
      const { data: assets, error } = await client
        .from('ig_automation_assets')
        .select('id, transcode_status')
        .eq('account_id', input.accountId)
        .in('id', assetIds);
      if (error) throw new Error(error.message);
      if ((assets ?? []).length !== assetIds.length) {
        throw new Error('One of the chosen files no longer exists');
      }
      if ((assets ?? []).some((a) => a.transcode_status !== 'ready')) {
        throw new Error(
          'A chosen file is still processing or failed. Pick another.',
        );
      }
    }

    const specificPost = input.media_scope === 'specific_post';
    const matchType = input.use_regex
      ? 'regex'
      : input.match_mode === 'exact'
        ? 'exact'
        : 'contains';

    const row = {
      ig_account_id: igAccount.id,
      account_id: input.accountId,
      name: input.name.trim(),
      keywords: input.match_mode === 'any' ? [] : input.keywords,
      match_type: matchType,
      scope: specificPost ? 'specific_posts' : 'all_posts',
      target_media_ids:
        specificPost && input.media_id ? [input.media_id] : null,
      trigger_type: input.trigger_type,
      match_mode: input.match_mode,
      media_scope: input.media_scope,
      media_id: specificPost ? (input.media_id ?? null) : null,
      require_follow: input.require_follow,
      once_per_contact: input.once_per_contact,
      cooldown_minutes: input.cooldown_minutes || null,
      public_reply_enabled:
        input.trigger_type === 'comment_keyword' && input.public_reply_enabled,
      public_reply_mode: input.public_reply_mode,
      public_reply_template: input.public_reply_template?.trim() || null,
      public_reply_ai_tier: input.public_reply_ai_tier,
      dm_enabled: true,
      dm_mode: 'static',
      dm_template: null,
      dm_flow: null,
      create_deal_on_match: input.create_deal_on_match,
      deal_stage: input.deal_stage || 'lead',
      is_active: input.is_active,
    };

    let triggerId = input.triggerId;
    if (triggerId) {
      const { error } = await client
        .from('ig_triggers')
        .update(row)
        .eq('id', triggerId)
        .eq('account_id', input.accountId);
      if (error) throw new Error(error.message);
    } else {
      const { count } = await client
        .from('ig_triggers')
        .select('id', { count: 'exact', head: true })
        .eq('account_id', input.accountId);
      const entitlement = await assertIgAutomationAllowed(
        client,
        input.accountId,
        count ?? 0,
      );
      if (!entitlement.allowed) {
        throw new Error(
          entitlement.reason ?? 'Instagram automation limit reached',
        );
      }

      const { data, error } = await client
        .from('ig_triggers')
        .insert(row)
        .select('id')
        .single();
      if (error || !data) throw new Error(error?.message ?? 'Could not save');
      triggerId = data.id as string;
    }

    const { error: stepsError } = await client.rpc(
      'replace_ig_automation_steps',
      {
        p_trigger_id: triggerId,
        p_steps: input.steps.map((step) => ({
          step_type: step.step_type,
          config: step.config,
          asset_id: step.asset_id,
        })),
      },
    );
    if (stepsError) throw new Error(stepsError.message);

    revalidateAutomationPaths(slug, triggerId);
    return { ok: true as const, triggerId };
  },
  { schema: saveIgAutomationActionSchema },
);

const accountOnlySchema = z.object({ accountId: z.string().uuid() });

async function loadActiveIgAccountWithToken(accountId: string) {
  const admin = getSupabaseServerAdminClient();
  const { data } = await admin
    .from('ig_connected_accounts')
    .select('*')
    .eq('account_id', accountId)
    .eq('is_active', true)
    .maybeSingle();
  if (!data) throw new Error('Connect an Instagram account first');
  return { admin, igAccount: data as IgConnectedAccountRow };
}

export const listIgPostsForPicker = enhanceAction(
  async (input, user): Promise<IgMediaItem[]> => {
    await assertInstagramAutoreplyAccess(input.accountId, user.id);
    const { igAccount } = await loadActiveIgAccountWithToken(input.accountId);
    try {
      return await listIgMedia(
        igAccount.ig_business_account_id,
        decryptIgToken(igAccount.access_token),
        30,
      );
    } catch {
      throw new Error('Could not load your Instagram posts. Try reconnecting.');
    }
  },
  { schema: accountOnlySchema },
);

export const listIgTestContacts = enhanceAction(
  async (input, user) => {
    const { client } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );
    const { data, error } = await client
      .from('ig_contacts')
      .select('id, username, display_name, last_inbound_at, opted_out_at')
      .eq('account_id', input.accountId)
      .not('last_inbound_at', 'is', null)
      .order('last_inbound_at', { ascending: false })
      .limit(20);
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({
      id: c.id as string,
      username: c.username as string | null,
      displayName: c.display_name as string | null,
      lastInboundAt: c.last_inbound_at as string | null,
      optedOut: Boolean(c.opted_out_at),
      windowOpen: isWithinMessagingWindow(c.last_inbound_at as string | null),
    }));
  },
  { schema: accountOnlySchema },
);

/**
 * "Send to me": run the saved sequence against a contact who has messaged
 * the account in the last 24 hours (Instagram only allows replies then).
 */
export const sendIgTestRun = enhanceAction(
  async (input, user) => {
    const { client } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );
    await assertIgManagePermission(client, input.accountId, user.id);

    const [{ data: trigger }, { data: contactCheck }] = await Promise.all([
      client
        .from('ig_triggers')
        .select('id')
        .eq('id', input.triggerId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
      client
        .from('ig_contacts')
        .select('id')
        .eq('id', input.contactId)
        .eq('account_id', input.accountId)
        .maybeSingle(),
    ]);
    if (!trigger || !contactCheck) throw new Error('Not found');

    const { admin, igAccount } = await loadActiveIgAccountWithToken(
      input.accountId,
    );
    const [{ data: fullTrigger }, { data: contact }] = await Promise.all([
      admin.from('ig_triggers').select('*').eq('id', input.triggerId).single(),
      admin.from('ig_contacts').select('*').eq('id', input.contactId).single(),
    ]);
    const testContact = contact as IgContactRow;

    if (testContact.opted_out_at) {
      throw new Error(
        'This person has opted out. They can message START to opt back in.',
      );
    }
    if (!isWithinMessagingWindow(testContact.last_inbound_at)) {
      throw new Error(
        'Instagram only allows messages within 24 hours of their last message. Send your business account a DM from this profile, then try again.',
      );
    }

    const result = await startIgRun(admin, {
      trigger: fullTrigger as IgTriggerFullRow,
      igAccount,
      contact: testContact,
      source: 'test',
      sourceEventId: `test:${randomUUID()}`,
      skipGuards: true,
    });
    if (result.status !== 'started') {
      throw new Error('Could not start the test');
    }

    const { data: run } = await admin
      .from('ig_automation_runs')
      .select('status, last_error')
      .eq('id', result.runId)
      .single();

    return {
      ok: true as const,
      status: run?.status as string,
      lastError: (run?.last_error as string | null) ?? null,
    };
  },
  { schema: sendIgTestRunActionSchema },
);
