'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  insufficientCreditsResponse,
  isInsufficientCreditsError,
} from '~/lib/ai/router';
import { assertInstagramAutoreplyAccess } from '~/lib/instagram-autoreply/assert-access';
import { resolveIgVoiceSettings } from '~/lib/instagram-autoreply/build-reply-prompt';
import { generateIgReply } from '~/lib/instagram-autoreply/generate-reply';
import { parseIgVoiceSettings } from '~/lib/instagram-autoreply/types';

import {
  deleteIgTriggerActionSchema,
  disconnectIgAccountActionSchema,
  previewIgReplyActionSchema,
  toggleIgTriggerActionSchema,
  updateIgVoiceSettingsActionSchema,
  upsertIgTriggerActionSchema,
} from '../schema/instagram-autoreply.schema';

function workPath(template: string, accountSlug: string) {
  return template.replace('[account]', accountSlug);
}

function revalidateInstagramPaths(accountSlug: string) {
  revalidatePath(workPath(pathsConfig.app.accountInstagramAutoreply, accountSlug));
  revalidatePath(
    workPath(pathsConfig.app.accountInstagramAutoreplyTriggers, accountSlug),
  );
  revalidatePath(
    workPath(pathsConfig.app.accountInstagramAutoreplyActivity, accountSlug),
  );
}

export const updateIgVoiceSettings = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { data: existing } = await client
      .from('ig_connected_accounts')
      .select('id')
      .eq('account_id', input.accountId)
      .maybeSingle();

    if (!existing) {
      throw new Error('Connect an Instagram account first');
    }

    const { error } = await client
      .from('ig_connected_accounts')
      .update({ voice_settings: input.voiceSettings })
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidateInstagramPaths(slug);
    return { ok: true as const };
  },
  { schema: updateIgVoiceSettingsActionSchema },
);

export const disconnectIgAccount = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { error } = await client
      .from('ig_connected_accounts')
      .update({ is_active: false })
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidateInstagramPaths(slug);
    return { ok: true as const };
  },
  { schema: disconnectIgAccountActionSchema },
);

export const previewIgReply = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { data: igAccount } = await client
      .from('ig_connected_accounts')
      .select('voice_settings')
      .eq('account_id', input.accountId)
      .maybeSingle();

    const accountVoice = parseIgVoiceSettings(
      (igAccount as { voice_settings?: unknown } | null)?.voice_settings,
    );
    const voiceSettings = input.voiceSettings
      ? resolveIgVoiceSettings(accountVoice, input.voiceSettings)
      : accountVoice;

    try {
      const result = await generateIgReply({
        client,
        accountId: input.accountId,
        userId: user.id,
        voiceSettings,
        commentText: input.sampleComment,
        commenterUsername: 'preview_user',
        channel: 'public_comment',
        mode: 'ai_generated',
        aiTier: 'standard',
        staticTemplate: null,
      });

      if (!result.ok) {
        throw new Error(result.message);
      }

      revalidateInstagramPaths(slug);
      return {
        ok: true as const,
        text: result.text,
        creditsSpent: result.creditsSpent,
      };
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        return {
          ok: false as const,
          ...insufficientCreditsResponse(error),
        };
      }
      throw error;
    }
  },
  { schema: previewIgReplyActionSchema },
);

export const upsertIgTrigger = enhanceAction(
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
      throw new Error('Connect an Instagram account before creating triggers');
    }

    const payload = {
      ig_account_id: (igAccount as { id: string }).id,
      account_id: input.accountId,
      name: input.name.trim(),
      keywords: input.keywords.map((k) => k.trim()).filter(Boolean),
      match_type: input.match_type,
      scope: input.scope,
      target_media_ids:
        input.scope === 'specific_posts' ? input.target_media_ids ?? [] : null,
      public_reply_enabled: input.public_reply_enabled,
      public_reply_mode: input.public_reply_mode,
      public_reply_template: input.public_reply_template?.trim() || null,
      public_reply_ai_tier: input.public_reply_ai_tier,
      dm_enabled: input.dm_enabled,
      dm_mode: input.dm_mode,
      dm_template: input.dm_template?.trim() || null,
      dm_ai_tier: input.dm_ai_tier,
      voice_settings_override: input.voice_settings_override ?? null,
      create_deal_on_match: input.create_deal_on_match,
      deal_stage: input.deal_stage || 'lead',
      is_active: input.is_active,
    };

    if (input.triggerId) {
      const { error } = await client
        .from('ig_triggers')
        .update(payload)
        .eq('id', input.triggerId)
        .eq('account_id', input.accountId);

      if (error) {
        throw new Error(error.message);
      }
    } else {
      const { error } = await client.from('ig_triggers').insert(payload);
      if (error) {
        throw new Error(error.message);
      }
    }

    revalidateInstagramPaths(slug);
    return { ok: true as const };
  },
  { schema: upsertIgTriggerActionSchema },
);

export const deleteIgTrigger = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { error } = await client
      .from('ig_triggers')
      .delete()
      .eq('id', input.triggerId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidateInstagramPaths(slug);
    return { ok: true as const };
  },
  { schema: deleteIgTriggerActionSchema },
);

export const toggleIgTrigger = enhanceAction(
  async (input, user) => {
    const { client, slug } = await assertInstagramAutoreplyAccess(
      input.accountId,
      user.id,
    );

    const { error } = await client
      .from('ig_triggers')
      .update({ is_active: input.is_active })
      .eq('id', input.triggerId)
      .eq('account_id', input.accountId);

    if (error) {
      throw new Error(error.message);
    }

    revalidateInstagramPaths(slug);
    return { ok: true as const };
  },
  { schema: toggleIgTriggerActionSchema },
);
