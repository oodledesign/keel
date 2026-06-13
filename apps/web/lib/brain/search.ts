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
    match_threshold: params.threshold ?? 0.4,
    match_count: params.scope
      ? (params.matchCount ?? 10) * 3
      : (params.matchCount ?? 10),
  });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as BrainMatch[];
  if (!params.scope) return rows.slice(0, params.matchCount ?? 10);

  return rows
    .filter((row) => matchesScope(row.metadata ?? {}, params.scope))
    .slice(0, params.matchCount ?? 10);
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
