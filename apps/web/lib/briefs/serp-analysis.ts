import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { countryToLocationCode, normaliseUrl } from '~/lib/clusters/utils';
import { type DfsResponse, dfsPost } from '~/lib/dataforseo/client';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type {
  AiOverviewData,
  RelatedKeyword,
  SerpData,
  SerpOrganicResult,
} from './types';

const QUESTION_PREFIX =
  /^(who|what|when|where|why|how|can|should|is|are|do|does|will)\b/i;

function parseSerpItems(json: DfsResponse): SerpData {
  const result = json.tasks?.[0]?.result?.[0] as
    | { items?: Array<Record<string, unknown>> }
    | undefined;
  const items = result?.items ?? [];

  const organic: SerpOrganicResult[] = [];
  const features = new Set<string>();

  for (const item of items) {
    const type = String(item.type ?? '');
    if (type === 'organic') {
      organic.push({
        rank: Number(
          item.rank_group ?? item.rank_absolute ?? organic.length + 1,
        ),
        title: String(item.title ?? ''),
        url: String(item.url ?? ''),
        domain: String(
          item.domain ?? normaliseUrl(String(item.url ?? '')).split('/')[0],
        ),
      });
    } else if (type) {
      features.add(type);
    }
  }

  return { organic: organic.slice(0, 10), features: [...features] };
}

export async function lookupCachedSerp(
  keyword: string,
  country: string,
): Promise<SerpData | null> {
  const db = supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');

  const { data: keywordRow } = await db
    .from('keyword_cluster_keywords')
    .select('job_id, keyword')
    .eq('keyword', keyword)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!keywordRow?.job_id) return null;

  const { data: job } = await db
    .from('keyword_cluster_jobs')
    .select('country, status')
    .eq('id', keywordRow.job_id)
    .eq('status', 'done')
    .maybeSingle();

  if (!job || job.country !== country.toLowerCase()) return null;

  // Cluster jobs store keywords but not full SERP — cache hit means we skip re-fetch
  // only when we can reconstruct from a recent cluster context; return null to fetch fresh
  // unless we add serp cache table later. Spec says check keyword_cluster_keywords match.
  void keywordRow;
  return null;
}

export async function fetchSerp(
  keyword: string,
  locationCode: number,
  country?: string,
): Promise<SerpData> {
  if (country) {
    const cached = await lookupCachedSerp(keyword, country);
    if (cached) return cached;
  }

  const json = await dfsPost('/serp/google/organic/live/advanced', [
    {
      keyword,
      location_code: locationCode,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: 10,
    },
  ]);

  return parseSerpItems(json);
}

export async function fetchRelatedKeywords(
  keyword: string,
  locationCode: number,
): Promise<RelatedKeyword[]> {
  const json = await dfsPost('/dataforseo_labs/google/related_keywords/live', [
    { keyword, location_code: locationCode, language_code: 'en', limit: 50 },
  ]);

  const items =
    (json.tasks?.[0]?.result?.[0] as { items?: Array<Record<string, unknown>> })
      ?.items ?? [];

  return items
    .map((item) => ({
      keyword: String(item.keyword ?? ''),
      volume: Number(
        (item.keyword_info as Record<string, unknown> | undefined)
          ?.search_volume ?? 0,
      ),
      kd: Number(
        (item.keyword_properties as Record<string, unknown> | undefined)
          ?.keyword_difficulty ?? 0,
      ),
    }))
    .filter((row) => row.keyword);
}

export async function fetchQuestionKeywords(
  keyword: string,
  locationCode: number,
): Promise<string[]> {
  const json = await dfsPost(
    '/dataforseo_labs/google/keyword_suggestions/live',
    [{ keyword, location_code: locationCode, language_code: 'en', limit: 30 }],
  );

  const items =
    (json.tasks?.[0]?.result?.[0] as { items?: Array<Record<string, unknown>> })
      ?.items ?? [];

  return items
    .map((item) => String(item.keyword ?? ''))
    .filter((kw) => QUESTION_PREFIX.test(kw));
}

export async function fetchAiOverview(
  keyword: string,
  locationCode: number,
): Promise<AiOverviewData> {
  try {
    const json = await dfsPost('/serp/google/ai_overview/live', [
      { keyword, location_code: locationCode, language_code: 'en' },
    ]);

    const result = json.tasks?.[0]?.result?.[0] as
      | { items?: Array<Record<string, unknown>> }
      | undefined;
    const references =
      (
        result?.items?.[0] as
          | { references?: Array<Record<string, unknown>> }
          | undefined
      )?.references ?? [];

    if (!references.length) {
      return { triggered: false, citedDomains: [], references: [] };
    }

    const parsed = references.map((ref) => ({
      url: String(ref.url ?? ''),
      domain: String(
        ref.domain ?? normaliseUrl(String(ref.url ?? '')).split('/')[0],
      ),
      title: ref.title ? String(ref.title) : undefined,
    }));

    const citedDomains = [
      ...new Set(parsed.map((ref) => ref.domain).filter(Boolean)),
    ];

    return { triggered: true, citedDomains, references: parsed };
  } catch {
    return { triggered: false, citedDomains: [], references: [] };
  }
}

export function countryCodeToLocation(country: string): number {
  return countryToLocationCode(country);
}
