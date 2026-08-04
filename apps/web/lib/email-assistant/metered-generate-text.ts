import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { GenerateTextFn } from '@kit/email-assistant';

import { type OzerAIFeatureKey, callAI } from '~/lib/ai/router';

export function createMeteredEmailGenerateText(input: {
  feature: OzerAIFeatureKey;
  accountId: string;
  supabase: SupabaseClient;
}): GenerateTextFn {
  return async ({ system, user }) =>
    callAI({
      feature: input.feature,
      systemPrompt: system,
      userPrompt: user,
      accountId: input.accountId,
      supabase: input.supabase,
    });
}
