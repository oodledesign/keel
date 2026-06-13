import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { extractJsonObject } from '~/lib/ai/extract-json-object';

import { formatBrainContext, searchBrainChunks, type BrainMatch } from './search';
import { isVoyageConfigured } from './voyage';

const SYSTEM_PROMPT = `You are Keel's second brain assistant. Answer from the sources below only.
If the answer is not in the sources, say so clearly. Cite sources by [1], [2], etc.
Use UK English. Format replies as Markdown.`;

function getAnthropicConfig() {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not configured');
  const model =
    process.env.ANTHROPIC_MODEL?.trim() || 'claude-sonnet-4-20250514';
  return { apiKey, model };
}

export type BrainChatScope = {
  jobId?: string | null;
  clientId?: string | null;
  jobTitle?: string | null;
  clientName?: string | null;
};

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

  const matches = await searchBrainChunks(params.client, {
    accountId: params.accountId,
    query: params.userMessage,
    matchCount: 10,
    scope: {
      jobId: params.scope?.jobId ?? null,
      clientId: params.scope?.clientId ?? null,
    },
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

export async function streamBrainChatReply(userPrompt: string) {
  const { apiKey, model } = getAnthropicConfig();

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      stream: true,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  });

  if (!res.ok || !res.body) {
    throw new Error(
      `Anthropic API error (${res.status}): ${(await res.text()).slice(0, 400)}`,
    );
  }

  return res.body;
}

export async function summarizeThreadTitle(firstMessage: string) {
  try {
    const { apiKey, model } = getAnthropicConfig();
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 32,
        messages: [
          {
            role: 'user',
            content: `Summarise this question in at most 6 words, no quotes:\n${firstMessage.slice(0, 500)}`,
          },
        ],
      }),
    });

    if (!res.ok) return null;
    const body = (await res.json()) as {
      content?: Array<{ type: string; text?: string }>;
    };
    return body.content?.find((c) => c.type === 'text')?.text?.trim() ?? null;
  } catch {
    return null;
  }
}

export function parseSseAssistantText(stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let fullText = '';

  return {
    async *textChunks() {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const events = buffer.split('\n\n');
        buffer = events.pop() ?? '';

        for (const event of events) {
          const line = event
            .split('\n')
            .find((entry) => entry.startsWith('data: '));
          if (!line) continue;
          const payload = line.slice(6).trim();
          if (!payload || payload === '[DONE]') continue;

          try {
            const parsed = JSON.parse(payload) as {
              type?: string;
              delta?: { type?: string; text?: string };
            };
            if (
              parsed.type === 'content_block_delta' &&
              parsed.delta?.type === 'text_delta' &&
              parsed.delta.text
            ) {
              fullText += parsed.delta.text;
              yield parsed.delta.text;
            }
          } catch {
            // ignore malformed SSE frames
          }
        }
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
