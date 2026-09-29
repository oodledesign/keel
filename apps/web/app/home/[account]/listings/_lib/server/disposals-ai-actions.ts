'use server';

import type { SupabaseClient } from '@supabase/supabase-js';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { INSUFFICIENT_AI_CREDITS_CODE } from '~/lib/ai/ai-credits-exhausted';
import { callAI, isInsufficientCreditsError } from '~/lib/ai/router';
import {
  DISPOSALS_AI_BUCKETS,
  DISPOSALS_AI_BUCKET_LABELS,
  type DisposalsAiPeriodFacts,
  resolveDisposalsAiPeriods,
} from '~/lib/commercial/disposals-ai-facts';
import { canRoleUseDisposalsAi } from '~/lib/commercial/disposals-ai-presets';
import {
  disposalsAiSystemPrompt,
  disposalsAiUserPrompt,
} from '~/lib/commercial/disposals-ai-prompt';
import { clampHashtags } from '~/lib/commercial/linkedin-publishing/post-copy';
import { loadDisposalsAiFacts } from '~/lib/commercial/load-disposals-ai-context.server';

import { AskDisposalsAiSchema } from '../schema/disposals-ai.schema';

export type DisposalsAiPeriodSummary = {
  label: string;
  counts: Array<{ label: string; count: number }>;
};

export type DisposalsAiResult = {
  text: string;
  period: DisposalsAiPeriodSummary;
  comparison: DisposalsAiPeriodSummary | null;
  dataNotes: string[];
};

function summarise(facts: DisposalsAiPeriodFacts): DisposalsAiPeriodSummary {
  return {
    label: facts.period.label,
    counts: DISPOSALS_AI_BUCKETS.map((bucket) => ({
      label: DISPOSALS_AI_BUCKET_LABELS[bucket],
      count: facts.activity[bucket].count,
    })),
  };
}

export const askDisposalsAiAction = enhanceAction(
  async (input, user): Promise<DisposalsAiResult> => {
    const client = getSupabaseServerClient() as SupabaseClient;

    const { data: membership } = await client
      .from('accounts_memberships')
      .select('account_role')
      .eq('account_id', input.accountId)
      .eq('user_id', user.id)
      .maybeSingle();

    const role = membership?.account_role as string | undefined;
    if (!canRoleUseDisposalsAi(role)) {
      throw new Error('You do not have access to disposals in this workspace');
    }

    const now = new Date();
    const { period, comparison } = resolveDisposalsAiPeriods(input.prompt, now);

    const facts = await loadDisposalsAiFacts({
      client,
      accountId: input.accountId,
      userId: user.id,
      canSeeRestricted: role === 'owner' || role === 'admin',
      period,
      comparison,
      now,
    });

    try {
      const raw = await callAI({
        feature: 'disposals_assistant',
        systemPrompt: disposalsAiSystemPrompt(input.format),
        userPrompt: disposalsAiUserPrompt({ request: input.prompt, facts }),
        accountId: input.accountId,
        supabase: client,
      });

      const trimmed = raw.trim();
      const text =
        input.format === 'linkedin' ? clampHashtags(trimmed) : trimmed;
      if (!text) throw new Error('The assistant returned an empty response');

      return {
        text,
        period: summarise(facts.period),
        comparison: facts.comparison ? summarise(facts.comparison) : null,
        dataNotes: facts.dataNotes,
      };
    } catch (error) {
      if (isInsufficientCreditsError(error)) {
        throw new Error(
          `Not enough AI credits (need ${error.creditsRequired}, have ${error.creditsRemaining}). [${INSUFFICIENT_AI_CREDITS_CODE}]`,
        );
      }
      throw error;
    }
  },
  { schema: AskDisposalsAiSchema },
);
