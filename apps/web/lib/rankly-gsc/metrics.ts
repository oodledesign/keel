import 'server-only';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { normalizeSearchQuery } from './domain';
import type { GscKeywordSupplement } from './types';

function db(client: unknown) {
  return supabaseCustomSchema(client, 'rankly');
}

function daysAgoDate(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

/**
 * Aggregate recent GSC query metrics for tracked keywords (matched by normalized query).
 */
export async function loadGscKeywordSupplements(
  client: unknown,
  projectId: string,
  options?: { days?: number },
): Promise<Map<string, GscKeywordSupplement>> {
  const days = options?.days ?? 28;
  const since = daysAgoDate(days + 3);

  const { data, error } = await db(client)
    .from('gsc_query_metrics')
    .select('query_normalized, clicks, impressions, ctr, position')
    .eq('project_id', projectId)
    .gte('metric_date', since);

  if (error) {
    throw new Error(error.message);
  }

  const aggregates = new Map<
    string,
    {
      clicks: number;
      impressions: number;
      positionWeighted: number;
    }
  >();

  for (const row of (data as Array<{
    query_normalized: string;
    clicks: number;
    impressions: number;
    position: number;
  }> | null) ?? []) {
    const key = normalizeSearchQuery(row.query_normalized);
    const current = aggregates.get(key) ?? {
      clicks: 0,
      impressions: 0,
      positionWeighted: 0,
    };
    const impressions = Number(row.impressions) || 0;
    current.clicks += Number(row.clicks) || 0;
    current.impressions += impressions;
    current.positionWeighted += (Number(row.position) || 0) * impressions;
    aggregates.set(key, current);
  }

  const result = new Map<string, GscKeywordSupplement>();
  for (const [key, value] of aggregates) {
    result.set(key, {
      queryNormalized: key,
      clicks: value.clicks,
      impressions: value.impressions,
      ctr: value.impressions > 0 ? value.clicks / value.impressions : 0,
      position:
        value.impressions > 0
          ? Math.round((value.positionWeighted / value.impressions) * 10) / 10
          : null,
    });
  }

  return result;
}

export async function loadTopGscQueries(
  client: unknown,
  projectId: string,
  options?: { days?: number; limit?: number },
): Promise<GscKeywordSupplement[]> {
  const map = await loadGscKeywordSupplements(client, projectId, {
    days: options?.days,
  });
  const limit = options?.limit ?? 25;

  return [...map.values()]
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, limit);
}
