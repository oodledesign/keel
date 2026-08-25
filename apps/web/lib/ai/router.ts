// Env: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY
import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenAI } from '@google/genai';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { INSUFFICIENT_AI_CREDITS_CODE } from '~/lib/ai/ai-credits-exhausted';
import {
  notifyAiCreditThresholds,
  notifyAiCreditsExhausted,
} from '~/lib/ai/notify-ai-credit-thresholds';
import {
  AI_CRISIS_REPLY,
  detectCrisisIntent,
  isConversationalAiFeature,
  withAiSafetySystemPrompt,
} from '~/lib/ai/safety';

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
  website_brief_extract: 'website_brief_extract',
  website_brief_suggest: 'website_brief_suggest',
  website_sitemap_generate: 'website_sitemap_generate',
  website_wireframe_generate: 'website_wireframe_generate',
  website_style_suggest: 'website_style_suggest',
  website_seo_generate: 'website_seo_generate',
  website_seo_answer_blocks: 'website_seo_answer_blocks',
  planner_generate: 'planner_generate',
  proposal_generate: 'proposal_generate',
  proposal_edit: 'proposal_edit',
  invoice_generate: 'invoice_generate',
  contract_generate: 'contract_generate',
  project_content_generate: 'project_content_generate',
  meal_plan_generate: 'meal_plan_generate',
  meal_recipes_generate: 'meal_recipes_generate',
  recipe_extract: 'recipe_extract',
  recipe_prep: 'recipe_prep',
  sop_import: 'sop_import',
  workspace_task_extract: 'workspace_task_extract',
  csv_map_finance: 'csv_map_finance',
  csv_map_client: 'csv_map_client',
  csv_map_task: 'csv_map_task',
  finance_category_suggest: 'finance_category_suggest',
  activity_assignment_suggest: 'activity_assignment_suggest',
  meetup_summary: 'meetup_summary',
  quick_action_plan: 'quick_action_plan',
  voice_profile_distill: 'voice_profile_distill',
  meeting_summary: 'meeting_summary',
  meeting_qa: 'meeting_qa',
  meeting_action_items: 'meeting_action_items',
  rankly_page_analyse: 'rankly_page_analyse',
  rankly_brief_synthesise: 'rankly_brief_synthesise',
  ai_audit_score: 'ai_audit_score',
  ai_audit_suggest: 'ai_audit_suggest',
  admin_email_marketing: 'admin_email_marketing',
  commercial_requirement_draft: 'commercial_requirement_draft',
  commercial_listing_marketing_copy: 'commercial_listing_marketing_copy',
  commercial_match_explain: 'commercial_match_explain',
  commercial_match_triage: 'commercial_match_triage',
  commercial_match_outreach: 'commercial_match_outreach',
  video_chapters: 'video_chapters',
  video_summary: 'video_summary',
  instagram_reply_draft: 'instagram_reply_draft',
  instagram_reply_enhanced: 'instagram_reply_enhanced',
} as const;

export type OzerAIFeatureKey =
  (typeof OzerAIFeature)[keyof typeof OzerAIFeature];

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
    credits: 0.5,
    batchable: false,
    maxOutputTokens: 512,
    structuredOutput: true,
  },
  task_extract: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 0.5,
    batchable: false,
    maxOutputTokens: 2048,
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
    credits: 5,
    batchable: false,
    maxOutputTokens: 4096,
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
    maxOutputTokens: 2048,
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
  website_brief_extract: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  website_brief_suggest: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  website_sitemap_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  website_wireframe_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  website_style_suggest: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 4,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  website_seo_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  website_seo_answer_blocks: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  planner_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 12,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  proposal_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 12,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  proposal_edit: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  invoice_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  contract_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  project_content_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  meal_plan_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  meal_recipes_generate: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  recipe_extract: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  recipe_prep: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: false,
  },
  sop_import: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  workspace_task_extract: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 5,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  csv_map_finance: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  csv_map_client: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  csv_map_task: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  finance_category_suggest: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  activity_assignment_suggest: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  meetup_summary: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: false,
  },
  quick_action_plan: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  voice_profile_distill: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: false,
  },
  meeting_summary: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: false,
  },
  meeting_qa: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: false,
  },
  meeting_action_items: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 5,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  rankly_page_analyse: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: true,
  },
  rankly_brief_synthesise: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 12,
    batchable: false,
    maxOutputTokens: 8192,
    structuredOutput: false,
  },
  ai_audit_score: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  ai_audit_suggest: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: true,
  },
  admin_email_marketing: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 8,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: false,
  },
  commercial_requirement_draft: {
    provider: 'google',
    model: GEMINI_FLASH_LITE_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: true,
  },
  commercial_listing_marketing_copy: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  commercial_match_explain: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  commercial_match_triage: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 2048,
    structuredOutput: true,
  },
  commercial_match_outreach: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 1024,
    structuredOutput: true,
  },
  video_chapters: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 3,
    batchable: false,
    maxOutputTokens: 4096,
    structuredOutput: false,
  },
  video_summary: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 2,
    batchable: false,
    maxOutputTokens: 512,
    structuredOutput: false,
  },
  instagram_reply_draft: {
    provider: 'anthropic',
    model: HAIKU_MODEL,
    credits: 5,
    batchable: false,
    maxOutputTokens: 512,
    structuredOutput: false,
  },
  instagram_reply_enhanced: {
    provider: 'anthropic',
    model: SONNET_MODEL,
    credits: 10,
    batchable: false,
    maxOutputTokens: 512,
    structuredOutput: false,
  },
};

export type AiCreditBalanceRow = {
  id: string;
  account_id: string;
  credits_remaining: number;
  credits_monthly_limit: number;
  /** One-time purchased credits that survive monthly reset. */
  credits_purchased: number;
  period_start: string;
  period_end: string;
  created_at: string;
  updated_at: string;
};

/** Round to one decimal place (half-credit metering). */
export function roundAiCredits(value: number): number {
  return Math.round(Number(value) * 10) / 10;
}

function coerceCreditBalance(row: Record<string, unknown>): AiCreditBalanceRow {
  return {
    id: String(row.id),
    account_id: String(row.account_id),
    credits_remaining: roundAiCredits(Number(row.credits_remaining ?? 0)),
    credits_monthly_limit: roundAiCredits(
      Number(row.credits_monthly_limit ?? 0),
    ),
    credits_purchased: roundAiCredits(Number(row.credits_purchased ?? 0)),
    period_start: String(row.period_start),
    period_end: String(row.period_end),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export function totalCreditsAvailable(balance: AiCreditBalanceRow): number {
  return roundAiCredits(
    Math.max(0, balance.credits_remaining) +
      Math.max(0, balance.credits_purchased ?? 0),
  );
}

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

export function isInsufficientCreditsError(
  error: unknown,
): error is OzerInsufficientCreditsError {
  return error instanceof OzerInsufficientCreditsError;
}

const getAnthropicClient = () =>
  new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const getGoogleClient = () =>
  new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY });

function hasGoogleAiApiKey(): boolean {
  return Boolean(process.env.GOOGLE_AI_API_KEY?.trim());
}

/**
 * Resolve runtime provider config. High-volume Flash features fall back to Haiku
 * (full 1-credit price) when GOOGLE_AI_API_KEY is not configured.
 */
export function resolveFeatureConfig(feature: OzerAIFeatureKey): FeatureConfig {
  const config = FEATURE_CONFIG[feature];

  if (
    config.provider === 'google' &&
    !hasGoogleAiApiKey() &&
    (feature === 'task_extract' || feature === 'email_triage')
  ) {
    return {
      ...config,
      provider: 'anthropic',
      model: HAIKU_MODEL,
      credits: 1,
    };
  }

  return config;
}

/**
 * Credit balance mutations are service-role only (see ai_credits migrations).
 * Callers still pass a user-scoped client for auth context elsewhere; credit
 * reads/writes always go through the admin client.
 */
function aiCreditsDb() {
  return getSupabaseServerAdminClient();
}

export async function getOrCreateCreditBalance(
  accountId: string,
  _supabase?: SupabaseClient,
): Promise<AiCreditBalanceRow> {
  const supabase = aiCreditsDb();
  const { data: existing, error: selectError } = await supabase
    .from('ai_credit_balances')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (selectError) {
    throw new Error(selectError.message);
  }

  if (existing) {
    return coerceCreditBalance(existing as Record<string, unknown>);
  }

  const { data: inserted, error: insertError } = await supabase
    .from('ai_credit_balances')
    .insert({
      account_id: accountId,
      credits_remaining: 200,
      credits_monthly_limit: 200,
      credits_purchased: 0,
    })
    .select('*')
    .single();

  if (insertError || !inserted) {
    throw new Error(
      insertError?.message ?? 'Failed to create AI credit balance',
    );
  }

  return coerceCreditBalance(inserted as Record<string, unknown>);
}

async function loadCreditBalanceForDebit(
  accountId: string,
): Promise<AiCreditBalanceRow> {
  const supabase = aiCreditsDb();
  const { error: resetError } = await supabase.rpc(
    'reset_ai_credits_if_expired',
    {
      p_account_id: accountId,
    },
  );

  if (resetError) {
    throw new Error(resetError.message);
  }

  const balanceQuery = await supabase
    .from('ai_credit_balances')
    .select('*')
    .eq('account_id', accountId)
    .maybeSingle();

  if (balanceQuery.error) {
    throw new Error(balanceQuery.error.message);
  }

  if (balanceQuery.data) {
    return coerceCreditBalance(balanceQuery.data as Record<string, unknown>);
  }

  await getOrCreateCreditBalance(accountId, supabase);
  const refreshed = await supabase
    .from('ai_credit_balances')
    .select('*')
    .eq('account_id', accountId)
    .single();

  if (refreshed.error || !refreshed.data) {
    throw new Error(
      refreshed.error?.message ?? 'Failed to load AI credit balance',
    );
  }

  return coerceCreditBalance(refreshed.data as Record<string, unknown>);
}

/**
 * Soft balance check before calling a provider. Does not debit — pair with
 * checkAndDeductCredits after a successful response so failed/timed-out calls
 * cannot silently burn the wallet.
 */
export async function assertSufficientCredits(
  accountId: string,
  credits: number,
  _supabase?: SupabaseClient,
): Promise<AiCreditBalanceRow> {
  const creditsNeeded = roundAiCredits(credits);
  const row = await loadCreditBalanceForDebit(accountId);
  const available = totalCreditsAvailable(row);

  if (available < creditsNeeded) {
    await notifyAiCreditsExhausted({
      accountId,
      creditsRemaining: available,
      creditsRequired: creditsNeeded,
    });
    throw new OzerInsufficientCreditsError({
      creditsRemaining: available,
      creditsRequired: creditsNeeded,
    });
  }

  return row;
}

export async function checkAndDeductCredits(
  accountId: string,
  credits: number,
  _supabase?: SupabaseClient,
  attempt = 0,
): Promise<AiCreditBalanceRow> {
  const supabase = aiCreditsDb();
  const creditsNeeded = roundAiCredits(credits);
  const row = await loadCreditBalanceForDebit(accountId);
  const monthly = Math.max(0, row.credits_remaining);
  const purchased = Math.max(0, row.credits_purchased ?? 0);
  const available = roundAiCredits(monthly + purchased);

  if (available < creditsNeeded) {
    await notifyAiCreditsExhausted({
      accountId,
      creditsRemaining: available,
      creditsRequired: creditsNeeded,
    });
    throw new OzerInsufficientCreditsError({
      creditsRemaining: available,
      creditsRequired: creditsNeeded,
    });
  }

  // Spend plan pool first, then purchased top-ups.
  const fromMonthly = Math.min(monthly, creditsNeeded);
  const fromPurchased = roundAiCredits(creditsNeeded - fromMonthly);
  const nextMonthly = roundAiCredits(monthly - fromMonthly);
  const nextPurchased = roundAiCredits(purchased - fromPurchased);

  const { data: updated, error: updateError } = await supabase
    .from('ai_credit_balances')
    .update({
      credits_remaining: nextMonthly,
      credits_purchased: nextPurchased,
      updated_at: new Date().toISOString(),
    })
    .eq('account_id', accountId)
    .eq('credits_remaining', monthly)
    .eq('credits_purchased', purchased)
    .select('*')
    .maybeSingle();

  if (updateError) {
    throw new Error(updateError.message);
  }

  if (!updated) {
    const { data: latest } = await supabase
      .from('ai_credit_balances')
      .select('credits_remaining, credits_purchased')
      .eq('account_id', accountId)
      .maybeSingle();

    const latestRow = latest as {
      credits_remaining?: number | string;
      credits_purchased?: number | string;
    } | null;

    const creditsRemaining = roundAiCredits(
      Math.max(0, Number(latestRow?.credits_remaining ?? 0)) +
        Math.max(0, Number(latestRow?.credits_purchased ?? 0)),
    );

    if (creditsRemaining < creditsNeeded) {
      await notifyAiCreditsExhausted({
        accountId,
        creditsRemaining,
        creditsRequired: creditsNeeded,
      });

      throw new OzerInsufficientCreditsError({
        creditsRemaining,
        creditsRequired: creditsNeeded,
      });
    }

    // Concurrent update won the lock but balance is still sufficient — retry a few times.
    if (attempt >= 2) {
      throw new Error('AI credit balance changed concurrently — please retry');
    }

    return checkAndDeductCredits(
      accountId,
      creditsNeeded,
      _supabase,
      attempt + 1,
    );
  }

  const nextBalance = coerceCreditBalance(updated as Record<string, unknown>);
  void notifyAiCreditThresholds({
    accountId,
    balance: {
      ...nextBalance,
      credit_alerts_sent: Number(
        (updated as { credit_alerts_sent?: number }).credit_alerts_sent ?? 0,
      ),
      credit_alert_period_start:
        (updated as { credit_alert_period_start?: string | null })
          .credit_alert_period_start ?? null,
    },
  });

  return nextBalance;
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
}: Omit<
  OzerAICallParams,
  'accountId' | 'supabase'
>): Promise<AIProviderResult> {
  const config = resolveFeatureConfig(feature);
  let text = '';
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  const safeSystemPrompt = withAiSafetySystemPrompt(feature, systemPrompt);

  if (config.provider === 'anthropic') {
    const anthropic = getAnthropicClient();
    const system = usePromptCaching
      ? [
          {
            type: 'text' as const,
            text: safeSystemPrompt,
            cache_control: { type: 'ephemeral' as const },
          },
        ]
      : safeSystemPrompt;

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
        systemInstruction: safeSystemPrompt,
        maxOutputTokens: config.maxOutputTokens,
        ...(config.structuredOutput && {
          responseMimeType: 'application/json',
          ...(responseSchema && { responseJsonSchema: responseSchema }),
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
  if (isConversationalAiFeature(feature) && detectCrisisIntent(userPrompt)) {
    return AI_CRISIS_REPLY;
  }

  const config = resolveFeatureConfig(feature);
  // Soft-check first; debit only after a successful provider response so
  // timeouts/provider errors cannot drain the wallet without a ledger row.
  await assertSufficientCredits(accountId, config.credits, supabase);

  const result = await invokeAIProvider({
    feature,
    systemPrompt,
    userPrompt,
    usePromptCaching,
    responseSchema,
  });

  await checkAndDeductCredits(accountId, config.credits, supabase);
  await logCreditTransaction({
    accountId,
    feature,
    provider: result.provider,
    model: result.model,
    credits: roundAiCredits(result.credits),
    inputTokens: result.inputTokens,
    outputTokens: result.outputTokens,
  });

  return result.text;
}

async function logCreditTransaction(input: {
  accountId: string;
  feature: string;
  provider: FeatureProvider;
  model: string;
  credits: number;
  inputTokens: number | null;
  outputTokens: number | null;
}) {
  const { error: txError } = await aiCreditsDb()
    .from('ai_credit_transactions')
    .insert({
      account_id: input.accountId,
      feature: input.feature,
      provider: input.provider,
      model_used: input.model,
      credits_used: input.credits,
      input_tokens: input.inputTokens,
      output_tokens: input.outputTokens,
      was_batched: false,
    });

  if (txError) {
    console.error(
      '[ai-router] failed to log credit transaction',
      txError.message,
    );
  }
}

/**
 * Deduct credits, stream Anthropic text deltas as a UTF-8 byte stream, then
 * log the credit transaction (with usage when the stream reports it).
 */
export async function streamAI({
  feature,
  systemPrompt,
  userPrompt,
  accountId,
  supabase,
  usePromptCaching = false,
}: OzerAICallParams): Promise<ReadableStream<Uint8Array>> {
  const config = resolveFeatureConfig(feature);
  if (config.provider !== 'anthropic') {
    throw new Error(
      `streamAI only supports Anthropic features (got ${feature})`,
    );
  }

  if (isConversationalAiFeature(feature) && detectCrisisIntent(userPrompt)) {
    const encoder = new TextEncoder();
    return new ReadableStream({
      start(controller) {
        controller.enqueue(encoder.encode(AI_CRISIS_REPLY));
        controller.close();
      },
    });
  }

  await assertSufficientCredits(accountId, config.credits, supabase);

  const anthropic = getAnthropicClient();
  const safeSystemPrompt = withAiSafetySystemPrompt(feature, systemPrompt);
  const system = usePromptCaching
    ? [
        {
          type: 'text' as const,
          text: safeSystemPrompt,
          cache_control: { type: 'ephemeral' as const },
        },
      ]
    : safeSystemPrompt;

  const anthropicStream = anthropic.messages.stream({
    model: config.model,
    max_tokens: config.maxOutputTokens,
    system,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const encoder = new TextEncoder();
  let inputTokens: number | null = null;
  let outputTokens: number | null = null;
  let settled = false;

  const chargeOnce = async () => {
    if (settled) return;
    settled = true;
    await checkAndDeductCredits(accountId, config.credits, supabase);
    await logCreditTransaction({
      accountId,
      feature,
      provider: 'anthropic',
      model: config.model,
      credits: config.credits,
      inputTokens,
      outputTokens,
    });
  };

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        anthropicStream.on('text', (text) => {
          controller.enqueue(encoder.encode(text));
        });

        const finalMessage = await anthropicStream.finalMessage();
        inputTokens = finalMessage.usage?.input_tokens ?? null;
        outputTokens = finalMessage.usage?.output_tokens ?? null;
        await chargeOnce();
        controller.close();
      } catch (error) {
        settled = true;
        controller.error(error);
      }
    },
    async cancel() {
      settled = true;
      try {
        anthropicStream.abort();
      } catch {
        // ignore abort errors
      }
    },
  });
}

export function insufficientCreditsResponse(
  error: OzerInsufficientCreditsError,
) {
  return {
    code: INSUFFICIENT_AI_CREDITS_CODE,
    error: error.message,
    creditsRemaining: error.creditsRemaining,
    creditsRequired: error.creditsRequired,
  };
}

/**
 * Deduct feature credits, run a custom provider call, then log the transaction.
 * Use when callAI/streamAI cannot express the request (multi-turn tools, etc.).
 */
export async function withMeteredAI<T>({
  feature,
  accountId,
  supabase,
  run,
}: {
  feature: OzerAIFeatureKey;
  accountId: string;
  supabase: SupabaseClient;
  run: () => Promise<{
    result: T;
    inputTokens?: number | null;
    outputTokens?: number | null;
  }>;
}): Promise<T> {
  const config = resolveFeatureConfig(feature);
  await assertSufficientCredits(accountId, config.credits, supabase);

  const { result, inputTokens = null, outputTokens = null } = await run();

  await checkAndDeductCredits(accountId, config.credits, supabase);
  await logCreditTransaction({
    accountId,
    feature,
    provider: config.provider,
    model: config.model,
    credits: config.credits,
    inputTokens,
    outputTokens,
  });

  return result;
}
