import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI, streamAI } from '~/lib/ai/router';
import { extractJsonObject } from '~/lib/ai/extract-json-object';

import {
  type BrainMatch,
  type BrainSearchScope,
  formatBrainContext,
  searchBrainChunks,
} from './search';
import { isVoyageConfigured } from './voyage';

const SYSTEM_PROMPT = `You are Ozer's second brain assistant. Answer from the sources below only.
If the answer is not in the sources, say so clearly. Cite sources by [1], [2], etc.
Use UK English. Format replies as Markdown.`;

export type BrainChatScope = {
  jobId?: string | null;
  clientId?: string | null;
  jobTitle?: string | null;
  clientName?: string | null;
};

async function resolveBrainSearchScope(
  client: SupabaseClient,
  accountId: string,
  scope?: BrainChatScope,
): Promise<BrainSearchScope | undefined> {
  if (!scope?.jobId && !scope?.clientId) return undefined;

  let clientId = scope.clientId ?? null;

  if (scope.jobId && !clientId) {
    const { data: job } = await client
      .from('jobs')
      .select('client_id')
      .eq('id', scope.jobId)
      .eq('account_id', accountId)
      .maybeSingle();

    clientId = (job?.client_id as string | null) ?? null;
  }

  return {
    jobId: scope.jobId ?? null,
    clientId,
  };
}

export type BrainContextRef = {
  source_type: string;
  source_id: string;
  title: string;
  url?: string;
  score: number;
  chunk_text?: string;
};

function buildContextRefs(matches: BrainMatch[]): BrainContextRef[] {
  return matches.map((match) => ({
    source_type: match.source_type,
    source_id: match.source_id,
    title: ((match.metadata?.title as string | undefined) ?? 'Source').trim(),
    url: (match.metadata?.source_url as string | undefined) ?? undefined,
    score: match.similarity,
    chunk_text: match.content_text,
  }));
}

export async function prepareBrainChat(params: {
  client: SupabaseClient;
  accountId: string;
  userMessage: string;
  scope?: BrainChatScope;
}) {
  if (!isVoyageConfigured()) {
    throw new Error('VOYAGE_API_KEY is not configured');
  }

  const searchScope = await resolveBrainSearchScope(
    params.client,
    params.accountId,
    params.scope,
  );

  const matches = await searchBrainChunks(params.client, {
    accountId: params.accountId,
    query: params.userMessage,
    matchCount: 16,
    scope: searchScope,
  });

  const contextBlock = formatBrainContext(matches);
  const scopeLine = params.scope?.jobId
    ? `Scope: job "${params.scope.jobTitle ?? params.scope.jobId}"`
    : params.scope?.clientId
      ? `Scope: client "${params.scope.clientName ?? params.scope.clientId}"`
      : 'Scope: entire workspace';

  const userPrompt = `${scopeLine}

Sources:
${contextBlock || '(no matching sources found)'}

Question: ${params.userMessage}`;

  return {
    matches,
    contextRefs: buildContextRefs(matches),
    userPrompt,
  };
}

export async function streamBrainChatReply(
  userPrompt: string,
  meter: { accountId: string; supabase: SupabaseClient },
) {
  return streamAI({
    feature: 'second_brain_query',
    systemPrompt: SYSTEM_PROMPT,
    userPrompt,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
}

export async function summarizeThreadTitle(
  firstMessage: string,
  meter: { accountId: string; supabase: SupabaseClient },
) {
  try {
    const title = await callAI({
      feature: 'note_summarise',
      systemPrompt:
        'Summarise the user question in at most 6 words. Reply with the title only — no quotes.',
      userPrompt: firstMessage.slice(0, 500),
      accountId: meter.accountId,
      supabase: meter.supabase,
    });
    return title.trim() || null;
  } catch {
    return null;
  }
}

export function parseSseAssistantText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let fullText = '';

  return {
    async *textChunks() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullText += chunk;
        yield chunk;
      }
    },
    getFullText: () => fullText,
  };
}

/** Utility for non-stream title JSON extraction if needed elsewhere. */
export function safeJsonParse(raw: string) {
  try {
    return JSON.parse(extractJsonObject(raw));
  } catch {
    return null;
  }
}
