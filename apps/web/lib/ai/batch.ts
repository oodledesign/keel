// Env: ANTHROPIC_API_KEY, GOOGLE_AI_API_KEY, CRON_SECRET
import 'server-only';

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  checkAndDeductCredits,
  FEATURE_CONFIG,
  invokeAIProvider,
  type OzerAIFeatureKey,
} from './router';

type BatchRequestPayload = {
  system: string;
  user: string;
  metadata?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
};

type BatchJobRow = {
  id: string;
  account_id: string;
  provider: string;
  external_batch_id: string | null;
  feature: string;
  status: string;
  requests: BatchRequestPayload[];
  credits_reserved: number;
};

function getAnthropicClient() {
  return new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
}

async function recordBatchedTransaction(
  job: BatchJobRow,
  inputTokens: number | null,
  outputTokens: number | null,
) {
  const config = FEATURE_CONFIG[job.feature as OzerAIFeatureKey];
  await getSupabaseServerAdminClient().from('ai_credit_transactions').insert({
    account_id: job.account_id,
    feature: job.feature,
    provider: job.provider,
    model_used: config.model,
    credits_used: job.credits_reserved,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    was_batched: true,
    metadata: job.requests[0]?.metadata ?? {},
  });
}

export async function queueBatchRequest({
  feature,
  systemPrompt,
  userPrompt,
  accountId,
  metadata,
  responseSchema,
  supabase,
}: {
  feature: OzerAIFeatureKey;
  systemPrompt: string;
  userPrompt: string;
  accountId: string;
  metadata?: Record<string, unknown>;
  responseSchema?: Record<string, unknown>;
  supabase: SupabaseClient;
}) {
  const config = FEATURE_CONFIG[feature];
  if (!config.batchable) {
    throw new Error(`Feature ${feature} is not batchable`);
  }

  await checkAndDeductCredits(accountId, config.credits, supabase);

  const { data, error } = await getSupabaseServerAdminClient()
    .from('ai_batch_jobs')
    .insert({
      account_id: accountId,
      provider: config.provider,
      feature,
      status: 'pending',
      requests: [
        {
          system: systemPrompt,
          user: userPrompt,
          metadata: metadata ?? {},
          responseSchema,
        },
      ],
      credits_reserved: config.credits,
    })
    .select('id')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to queue batch job');
  }

  return data.id as string;
}

export async function submitPendingBatches(supabase: SupabaseClient) {
  const { data: pendingJobs, error } = await supabase
    .from('ai_batch_jobs')
    .select('*')
    .eq('status', 'pending');

  if (error) {
    throw new Error(error.message);
  }

  const jobs = (pendingJobs ?? []) as BatchJobRow[];
  if (jobs.length === 0) {
    return 0;
  }

  const anthropicJobs = jobs.filter((job) => job.provider === 'anthropic');
  const googleJobs = jobs.filter((job) => job.provider === 'google');

  let processed = 0;

  for (let index = 0; index < anthropicJobs.length; index += 100) {
    const chunk = anthropicJobs.slice(index, index + 100);
    const anthropic = getAnthropicClient();

    const requests = chunk.map((job) => {
      const config = FEATURE_CONFIG[job.feature as OzerAIFeatureKey];
      const payload = job.requests[0];
      return {
        custom_id: job.id,
        params: {
          model: config.model,
          max_tokens: config.maxOutputTokens,
          system: payload?.system ?? '',
          messages: [{ role: 'user' as const, content: payload?.user ?? '' }],
        },
      };
    });

    const batch = await anthropic.messages.batches.create({ requests });
    const jobIds = chunk.map((job) => job.id);

    const { error: updateError } = await supabase
      .from('ai_batch_jobs')
      .update({
        status: 'submitted',
        external_batch_id: batch.id,
        updated_at: new Date().toISOString(),
      })
      .in('id', jobIds);

    if (updateError) {
      throw new Error(updateError.message);
    }

    processed += chunk.length;
  }

  for (const job of googleJobs) {
    // TODO: Wire Google batch when @google/genai exposes files.upload + batches.create.
    // googleClient.files.upload({ mimeType: 'application/jsonl', content: jsonlBuffer })
    // googleClient.batches.create({ model: GEMINI_FLASH_LITE_MODEL, src: uploadedFile.uri })
    const payload = job.requests[0];
    if (!payload) continue;

    try {
      const result = await invokeAIProvider({
        feature: job.feature as OzerAIFeatureKey,
        systemPrompt: payload.system,
        userPrompt: payload.user,
        responseSchema: payload.responseSchema,
      });

      await supabase
        .from('ai_batch_jobs')
        .update({
          status: 'completed',
          results: { text: result.text },
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);

      await recordBatchedTransaction(
        job,
        result.inputTokens,
        result.outputTokens,
      );
      processed += 1;
    } catch (err) {
      await supabase
        .from('ai_batch_jobs')
        .update({
          status: 'failed',
          error_message: err instanceof Error ? err.message : String(err),
          updated_at: new Date().toISOString(),
        })
        .eq('id', job.id);
    }
  }

  return processed;
}

export async function pollAndProcessBatches(supabase: SupabaseClient) {
  const { data: inFlight, error } = await supabase
    .from('ai_batch_jobs')
    .select('*')
    .in('status', ['submitted', 'processing']);

  if (error) {
    throw new Error(error.message);
  }

  const jobs = (inFlight ?? []) as BatchJobRow[];
  if (jobs.length === 0) {
    return 0;
  }

  const anthropicBatchIds = [
    ...new Set(
      jobs
        .filter((job) => job.provider === 'anthropic' && job.external_batch_id)
        .map((job) => job.external_batch_id as string),
    ),
  ];

  let processed = 0;
  const anthropic = getAnthropicClient();

  for (const batchId of anthropicBatchIds) {
    const batch = await anthropic.messages.batches.retrieve(batchId);

    if (batch.processing_status === 'in_progress') {
      await supabase
        .from('ai_batch_jobs')
        .update({ status: 'processing', updated_at: new Date().toISOString() })
        .eq('external_batch_id', batchId)
        .eq('status', 'submitted');
      continue;
    }

    if (batch.processing_status !== 'ended') {
      continue;
    }

    const results = await anthropic.messages.batches.results(batchId);
    for await (const result of results) {
      const jobId = result.custom_id;
      const job = jobs.find((row) => row.id === jobId);
      if (!job) continue;

      if (result.result.type === 'succeeded') {
        const message = result.result.message;
        const textBlock = message.content.find((block) => block.type === 'text');
        const text =
          textBlock && textBlock.type === 'text' ? textBlock.text : '';

        await supabase
          .from('ai_batch_jobs')
          .update({
            status: 'completed',
            results: { text },
            completed_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);

        await recordBatchedTransaction(
          job,
          message.usage.input_tokens,
          message.usage.output_tokens,
        );
        processed += 1;
      } else {
        const errorMessage =
          result.result.type === 'errored'
            ? result.result.error.error.message
            : 'Batch request failed';

        await supabase
          .from('ai_batch_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            updated_at: new Date().toISOString(),
          })
          .eq('id', jobId);
      }
    }
  }

  return processed;
}
