import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { PIPELINE_WORKSPACE_BUSINESS_PREFIX } from '~/home/(user)/_lib/pipeline-constants';
import { createDeal } from '~/home/(user)/pipeline/actions';

import type { PipelineLeadSuggestion } from './suggest-pipeline-lead';

export type CreatePipelineLeadFromThreadResult = {
  dealId: string;
  accountSlug: string | null;
};

function parseLeadSuggestion(value: unknown): PipelineLeadSuggestion | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const row = value as Record<string, unknown>;
  const accountId =
    typeof row.accountId === 'string'
      ? row.accountId
      : typeof row.account_id === 'string'
        ? row.account_id
        : null;

  const contactName =
    typeof row.contactName === 'string'
      ? row.contactName
      : typeof row.contact_name === 'string'
        ? row.contact_name
        : null;

  const companyName =
    typeof row.companyName === 'string'
      ? row.companyName
      : typeof row.company_name === 'string'
        ? row.company_name
        : null;

  if (!accountId || !contactName || !companyName) {
    return null;
  }

  return {
    accountId,
    contactName,
    companyName,
    contactEmail:
      typeof row.contactEmail === 'string'
        ? row.contactEmail
        : typeof row.contact_email === 'string'
          ? row.contact_email
          : null,
    description:
      typeof row.description === 'string' ? row.description : null,
  };
}

export async function createPipelineLeadFromThread(
  client: SupabaseClient,
  params: {
    userId: string;
    threadId: string;
    accountSlug?: string | null;
    suggestionOverride?: PipelineLeadSuggestion | null;
  },
): Promise<CreatePipelineLeadFromThreadResult> {
  const { data: thread, error } = await client
    .from('email_threads')
    .select(
      'id, subject, snippet, pipeline_lead_suggestion, pipeline_deal_id, client_id, account_id',
    )
    .eq('id', params.threadId)
    .eq('user_id', params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!thread) {
    throw new Error('Thread not found');
  }

  if (thread.pipeline_deal_id) {
    throw new Error('A pipeline lead already exists for this thread');
  }

  if (thread.client_id) {
    throw new Error('Thread is already linked to a client');
  }

  const suggestion =
    params.suggestionOverride ??
    parseLeadSuggestion(thread.pipeline_lead_suggestion);

  if (!suggestion) {
    throw new Error('No pipeline lead suggestion available');
  }

  const accountId = suggestion.accountId;
  const description =
    suggestion.description?.trim() ||
    [thread.subject, thread.snippet].filter(Boolean).join(' — ').trim() ||
    null;

  const result = await createDeal({
    contactName: suggestion.contactName,
    companyName: suggestion.companyName,
    value: 0,
    stage: 'lead',
    description,
    businessId: `${PIPELINE_WORKSPACE_BUSINESS_PREFIX}${accountId}`,
    accountId,
    accountSlug: params.accountSlug ?? undefined,
    clientId: null,
  });

  if (!result.success || !result.id) {
    throw new Error(result.error ?? 'Could not create pipeline lead');
  }

  const { error: updateError } = await client
    .from('email_threads')
    .update({
      pipeline_deal_id: result.id,
      pipeline_lead_suggestion: null,
      pipeline_lead_confidence: null,
      account_id: accountId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.threadId)
    .eq('user_id', params.userId);

  if (updateError) {
    throw new Error(updateError.message);
  }

  const { error: dealLinkError } = await client
    .from('pipeline_deals')
    .update({
      email_thread_id: params.threadId,
    })
    .eq('id', result.id);

  if (dealLinkError) {
    throw new Error(dealLinkError.message);
  }

  let accountSlug = params.accountSlug?.trim() || null;
  if (!accountSlug) {
    const { data: account } = await client
      .from('accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();
    accountSlug = (account?.slug as string | null) ?? null;
  }

  return { dealId: result.id, accountSlug };
}
