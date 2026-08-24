import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type OzerAIFeatureKey,
  callAI,
  isInsufficientCreditsError,
  resolveFeatureConfig,
  roundAiCredits,
} from '~/lib/ai/router';

import { buildInstagramReplyPrompts } from './build-reply-prompt';
import type { IgAiTier, IgReplyMode, IgVoiceSettings } from './types';

export type GenerateIgReplyInput = {
  client: SupabaseClient;
  accountId: string;
  userId?: string | null;
  voiceSettings: IgVoiceSettings;
  commentText: string;
  commenterUsername?: string | null;
  channel: 'public_comment' | 'dm';
  mode: IgReplyMode;
  aiTier: IgAiTier | null;
  staticTemplate: string | null;
};

export type GenerateIgReplyResult =
  | {
      ok: true;
      text: string;
      creditsSpent: number;
      usedAi: boolean;
    }
  | {
      ok: false;
      reason: 'skipped' | 'failed';
      message: string;
    };

function featureForTier(tier: IgAiTier | null): OzerAIFeatureKey {
  return tier === 'enhanced'
    ? 'instagram_reply_enhanced'
    : 'instagram_reply_draft';
}

export async function generateIgReply(
  input: GenerateIgReplyInput,
): Promise<GenerateIgReplyResult> {
  const staticFallback = input.staticTemplate?.trim() ?? '';

  if (input.mode === 'static') {
    if (!staticFallback) {
      return {
        ok: false,
        reason: 'skipped',
        message: 'No static template configured',
      };
    }
    return { ok: true, text: staticFallback, creditsSpent: 0, usedAi: false };
  }

  const feature = featureForTier(input.aiTier);
  const config = resolveFeatureConfig(feature);

  try {
    const { systemPrompt, userPrompt } = await buildInstagramReplyPrompts({
      client: input.client,
      accountId: input.accountId,
      userId: input.userId,
      voiceSettings: input.voiceSettings,
      commentText: input.commentText,
      commenterUsername: input.commenterUsername,
      channel: input.channel,
    });

    const text = await callAI({
      feature,
      systemPrompt,
      userPrompt,
      accountId: input.accountId,
      supabase: input.client,
    });

    const trimmed = text.trim();
    if (!trimmed) {
      if (staticFallback) {
        return {
          ok: true,
          text: staticFallback,
          creditsSpent: 0,
          usedAi: false,
        };
      }
      return {
        ok: false,
        reason: 'failed',
        message: 'AI returned empty text',
      };
    }

    return {
      ok: true,
      text: trimmed,
      creditsSpent: roundAiCredits(config.credits),
      usedAi: true,
    };
  } catch (error) {
    if (isInsufficientCreditsError(error)) {
      if (staticFallback) {
        return {
          ok: true,
          text: staticFallback,
          creditsSpent: 0,
          usedAi: false,
        };
      }
      return {
        ok: false,
        reason: 'skipped',
        message: error.message,
      };
    }

    if (staticFallback) {
      return {
        ok: true,
        text: staticFallback,
        creditsSpent: 0,
        usedAi: false,
      };
    }

    return {
      ok: false,
      reason: 'failed',
      message: error instanceof Error ? error.message : 'AI generation failed',
    };
  }
}
