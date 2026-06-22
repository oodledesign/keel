// Env: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY
import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';
import type { SupabaseClient } from '@supabase/supabase-js';

export const GEMINI_FLASH_LITE_MODEL = 'gemini-3.1-flash-lite';
export const HAIKU_MODEL = 'claude-haiku-4-5-20251001';
export const SONNET_MODEL = 'claude-sonnet-4-6';

export const OzerAIFeature = {
  email_triage: 'email_triage',
  email_draft: 'email_draft',
  email_draft_enhanced: 'email_draft_enhanced',
  task_extract: 'task_extract',
  note_summarise: 'note_summarise',
  meeting_intelligence_structured: 'meeting_intelligence_structured',
  meeting_intelligence_full: 'meeting_intelligence_full',
  second_brain_query: 'second_brain_query',
  ooo_generate: 'ooo_generate',
  meeting_recap: 'meeting_recap',
  weekly_digest: 'weekly_digest',
  complex_analysis: 'complex_analysis',
} as const;

export type OzerAIFeatureKey = (typeof OzerAIFeature)[keyof typeof OzerAIFeature];

type FeatureProvider = 'anthropic' | 'google';

type FeatureConfig = {
  provider: FeatureProvider;
  model: string;
  credits: number;
  batchable: boolean;
  maxOutputTokens: number;
  structuredOutput: boolean;
};

export const FEATURE_CONFIG: Record<OzerAIFeatureKey, FeatureConfig> = {
  email_triage: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 1,
    batchable: true,
    maxOutputTokens: 512,
    structuredOutput: true,
  },
  task_extract: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 1,
    batchable: true,
    maxOutputTokens: 512,
    structuredOutput: true,
  },
  meeting_recap: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 3,
    batchable: true,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  weekly_digest: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 3,
    batchable: true,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  note_summarise: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  second_brain_query: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  ooo_generate: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 512,
    structuredOutput: false,
  },
  email_draft: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 5,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  meeting_intelligence_structured: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 5,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: true,
  },
  email_draft_enhanced: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: false,
  },
  meeting_intelligence_full: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 12,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: false,
  },
  complex_analysis: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: false,
  },
};

export type AiCreditBalanceRow = {
  id: string;
  account_id: string;
  credits_remaining: number;
  credits_monthly_limit: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
};

export class OzerInsufficientCreditsError extends Error {
  readonly creditsRemaining: number;
  readonly creditsRequired: number;

  constructor(payload: { creditsRemaining: number; creditsRequired: number }) {
    super(
      `Insufficient AI credits: need ${payload.creditsRequired}, have ${payload.creditsRemaining}`,
    );
    this.name = 'OzerInsufficientCreditsError';
    this.creditsRemaining = payload.creditsRemaining;
    this.creditsRequired = payload.creditsRequired;
  }
}

const getAnthropicClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const getGoogleClient = () =>
  new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

export async function getOrCreateCreditBalance(
  accountId: string,
  supabase: SupabaseClient,
): Promise<AiCreditBalanceRow> {
  const { data: existing, error: selectError } = await supabase
    .from('ai_credit_balances')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) {
    return existing as AiCreditBalanceRow;
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ai_credit_balances')
    .insert({
      account_id: accountId,
      credits_remaining: 200,
      credits_monthly_limit: 200,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? 'Failed to create AI credit balance');
  }

  return inserted as AiCreditBalanceRow;
}

export async function checkAndDeductCredits(
  accountId: string,
  credits: number,
  supabase: SupabaseClient,
): Promise<AiCreditBalanceRow> {
  const { error: resetError } = await supabase.rpc('reset_ai_credits_if_expired', {
    p_account_id: accountId,
  });

  if (resetError) {
    throw new Error(resetError.message);
  }

  let { data: balance, error: balanceError } = await supabase
    .from('ai_credit_balances')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (balanceError) {
    throw new Error(balanceError.message);
  }

  if (!balance) {
    await getOrCreateCreditBalance(accountId, supabase);
    const refreshed = await supabase
      .from('ai_credit_balances')
      .select('*')
      .eq('account_id', accountId)
      .single();

    if (refreshed.error || !refreshed.data) {
      throw new Error(refreshed.error?.message ?? 'Failed to load AI credit balance');
    }

    balance = refreshed.data;
  }

  const remaining = (balance as AiCreditBalanceRow).credits_remaining;
  if (remaining < credits) {
    throw new OzerInsufficientCreditsError({
      creditsRemaining: remaining,
      creditsRequired: credits,
    });
  }

  const { data: updated, error: updateError } = await supabase
    .from('ai_credit_balances')
    .update({
      credits_remaining: remaining - credits,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .gte('credits_remaining', credits)
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated) {
    const { data: latest } = await supabase
      .from('ai_credit_balances')
      .select('credits_remaining')
      .eq('account_id', accountId)
      .maybeSingle();

    throw new OzerInsufficientCreditsError({
      creditsRemaining: (latest as { credits_remaining?: number } | null)
        ?.credits_remaining ?? 0,
      creditsRequired: credits,
    });
  }

  return updated as AiCreditBalanceRow;
}

export type OzerAICallParams = {
  feature: OzerAIFeatureKey;
  systemPrompt: string;
  userPrompt: string;
  accountId: string;
  supabase: SupabaseClient;
  usePromptCaching?: boolean;
  responseSchema?: Record<string, unknown>;
};

export type AIProviderResult = {
  text: string;
  inputTokens: number | null;
  outputTokens: number | null;
  provider: FeatureProvider;
  model: string;
  credits: number;
};

function extractAnthropicText(
  content: Anthropic.Messages.Message['content'],
): string {
  const block = content.find((item) => item.type === 'text');
  return block && block.type === 'text' ? block.text : '';
}

export async function invokeAIProvider({
  feature,
  systemPrompt,
  userPrompt,
  usePromptCaching = false,
  responseSchema,
}: Omit<OzerAICallParams, 'accountId' | 'supabase'>): Promise<AIProviderResult> {
  const config = FEATURE_CONFIG[feature];
  let text = '';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;

  if (config.provider === 'anthropic') {
    const anthropic = getAnthropicClient();
    const system = usePromptCaching
      ? [
          {
            type: 'text' as const,
            text: systemPrompt,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : systemPrompt;

    const response = await anthropic.messages.create({
      model: config.model,
      max_tokens: config.maxOutputTokens,
      system,
      messages: [{ role: 'user', content: userPrompt }],
    });

    text = extractAnthropicText(response.content);
    inputTokens = response.usage.input_tokens;
    outputTokens = response.usage.output_tokens;
  } else {
    const google = getGoogleClient();
    const response = await google.models.generateContent({
      model: config.model,
      contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      config: {
        systemInstruction: systemPrompt,
        maxOutputTokens: config.maxOutputTokens,
        ...(config.structuredOutput &&
          responseSchema && {
            responseMimeType: 'application/json',
            responseJsonSchema: responseSchema,
          }),
      },
    });

    text = response.text ?? '';
    inputTokens = response.usageMetadata?.promptTokenCount ?? null;
    outputTokens = response.usageMetadata?.candidatesTokenCount ?? null;
  }

  return {
    text,
    inputTokens,
    outputTokens,
    provider: config.provider,
    model: config.model,
    credits: config.credits,
  };
}

export async function callAI({
  feature,
  systemPrompt,
  userPrompt,
  accountId,
  supabase,
  usePromptCaching = false,
  responseSchema,
}: OzerAICallParams): Promise<string> {
  const config = FEATURE_CONFIG[feature];
  await checkAndDeductCredits(accountId, config.credits, supabase);

  const result = await invokeAIProvider({
    feature,
    systemPrompt,
    userPrompt,
    usePromptCaching,
    responseSchema,
  });

  const { error: txError } = await supabase.from('ai_credit_transactions').insert({
    account_id: accountId,
    feature,
    provider: result.provider,
    model_used: result.model,
    credits_used: result.credits,
    input_tokens: result.inputTokens,
    output_tokens: result.outputTokens,
    was_batched: false,
  });

  if (txError) {
    console.error('[ai-router] failed to log credit transaction', txError.message);
  }

  return result.text;
}
