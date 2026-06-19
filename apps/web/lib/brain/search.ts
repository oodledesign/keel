import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { embedQuery } from './voyage';

export type BrainMatch = {
  id: string;
  source_type: string;
  source_id: string;
  chunk_index: number;
  content_text: string;
  metadata: Record<string, unknown>;
  similarity: number;
};

export type BrainSearchScope = {
  jobId?: string | null;
  clientId?: string | null;
};

function matchesScope(
  metadata: Record<string, unknown>,
  scope?: BrainSearchScope,
) {
  if (!scope?.jobId && !scope?.clientId) return true;
  if (scope.jobId && metadata.job_id === scope.jobId) return true;
  if (scope.clientId && metadata.client_id === scope.clientId) return true;
  return false;
}

function extractSearchTerms(query: string) {
  return query
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((term) => term.length >= 3);
}

async function keywordSearchBrainChunks(
  client: SupabaseClient,
  params: {
    accountId: string;
    query: string;
    matchCount?: number;
    scope?: BrainSearchScope;
  },
): Promise<BrainMatch[]> {
  const terms = extractSearchTerms(params.query);
  if (terms.length === 0) return [];

  const { data, error } = await client
    .from('brain_chunks')
    .select('id, source_type, source_id, chunk_index, content_text, metadata')
    .eq('account_id', params.accountId);

  if (error || !data?.length) return [];

  const scored = data
    .map((row) => {
      const metadata = (row.metadata as Record<string, unknown> | null) ?? {};
      const haystack =
        `${metadata.title ?? ''} ${row.content_text ?? ''}`.toLowerCase();
      const hits = terms.filter((term) => haystack.includes(term)).length;
      if (hits === 0) return null;

      return {
        id: row.id as string,
        source_type: row.source_type as string,
        source_id: row.source_id as string,
        chunk_index: row.chunk_index as number,
        content_text: row.content_text as string,
        metadata,
        similarity: hits / terms.length,
      } satisfies BrainMatch;
    })
    .filter((row): row is BrainMatch => row !== null)
    .sort((a, b) => b.similarity - a.similarity);

  const scoped = params.scope
    ? scored.filter((row) => matchesScope(row.metadata ?? {}, params.scope))
    : scored;

  return scoped.slice(0, params.matchCount ?? 10);
}

export async function searchBrainChunks(
  client: SupabaseClient,
  params: {
    accountId: string;
    query: string;
    matchCount?: number;
    threshold?: number;
    scope?: BrainSearchScope;
  },
): Promise<BrainMatch[]> {
  const embedding = await embedQuery(params.query);

  const { data, error } = await client.rpc('match_brain_chunks', {
    query_embedding: embedding,
    match_account_id: params.accountId,
    match_threshold: params.threshold ?? 0.32,
    match_count: params.scope
      ? (params.matchCount ?? 10) * 3
      : (params.matchCount ?? 10),
  });

  if (error) throw new Error(error.message);

  let rows = (data ?? []) as BrainMatch[];

  if (params.scope) {
    rows = rows.filter((row) => matchesScope(row.metadata ?? {}, params.scope));
  }

  if (rows.length === 0) {
    rows = await keywordSearchBrainChunks(client, params);
  }

  return rows.slice(0, params.matchCount ?? 10);
}

export function formatBrainContext(matches: BrainMatch[]): string {
  return matches
    .map((match, index) => {
      const title =
        (match.metadata?.title as string | undefined)?.trim() || 'Source';
      const typeLabel = match.source_type.replace('_', ' ');
      return `--- [${index + 1}] ${typeLabel}: "${title}" ---\n${match.content_text}\n--- end ---`;
    })
    .join('\n\n');
}
