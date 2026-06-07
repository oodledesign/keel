import 'server-only';

import { normaliseOverviewDomain } from '~/lib/site-overview/domain';
import { countryToLocationCode } from '~/lib/clusters/utils';
import { delay } from '~/lib/clusters/utils';
import { dfsPost, type DfsResponse } from '~/lib/dataforseo/client';

import { extractApiCost } from './cost';

export type SerpRankResult = {
  keyword: string;
  device: 'desktop' | 'mobile';
  position: number | null;
  rankingUrl: string | null;
  aiOverviewPresent: boolean;
  serpFeatures: string[];
  apiCostUsd: number;
};

function domainMatchesUrl(domain: string, url: string): boolean {
  const host = normaliseOverviewDomain(domain);
  try {
    const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
    return normaliseOverviewDomain(parsed.hostname) === host;
  } catch {
    return url.toLowerCase().includes(host);
  }
}

function parseSerpItems(result: Record<string, unknown> | undefined): Array<Record<string, unknown>> {
  const items = result?.items;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
}

export function parseKeywordRankFromSerp(
  items: Array<Record<string, unknown>>,
  targetDomain: string,
): Pick<SerpRankResult, 'position' | 'rankingUrl' | 'aiOverviewPresent' | 'serpFeatures'> {
  const serpFeatures = items
    .map((item) => String(item.type ?? ''))
    .filter((type) => type && type !== 'organic');

  const aiOverviewPresent = items.some((item) => item.type === 'ai_overview');

  for (const item of items) {
    if (item.type !== 'organic') continue;
    const url = String(item.url ?? '');
    if (!url || !domainMatchesUrl(targetDomain, url)) continue;

    const position = Number(item.rank_group ?? item.rank_absolute ?? 0) || null;

    return {
      position,
      rankingUrl: url,
      aiOverviewPresent,
      serpFeatures: [...new Set(serpFeatures)],
    };
  }

  return {
    position: null,
    rankingUrl: null,
    aiOverviewPresent,
    serpFeatures: [...new Set(serpFeatures)],
  };
}

export async function fetchKeywordRanksBatch(input: {
  keywords: string[];
  targetDomain: string;
  countryCode: string;
  device: 'desktop' | 'mobile';
  depth?: number;
}): Promise<{ results: SerpRankResult[]; apiCostUsd: number }> {
  if (input.keywords.length === 0) {
    return { results: [], apiCostUsd: 0 };
  }

  const locationCode = countryToLocationCode(input.countryCode);
  const tasks = input.keywords.map((keyword) => ({
    keyword,
    location_code: locationCode,
    language_code: 'en',
    device: input.device,
    os: input.device === 'mobile' ? 'android' : 'windows',
    depth: input.depth ?? 100,
  }));

  const json = await dfsPost<DfsResponse>('/serp/google/organic/live/advanced', tasks);
  const apiCostUsd = extractApiCost(json);
  const results: SerpRankResult[] = [];

  for (const task of json.tasks ?? []) {
    const keyword = String(task.data?.keyword ?? '');
    const parsed = parseKeywordRankFromSerp(
      parseSerpItems(task.result?.[0] as Record<string, unknown> | undefined),
      input.targetDomain,
    );

    results.push({
      keyword,
      device: input.device,
      ...parsed,
      apiCostUsd: extractApiCost({ tasks: [task] }),
    });
  }

  await delay(200);

  return { results, apiCostUsd };
}

export async function fetchAllKeywordRanks(input: {
  keywords: Array<{ id: string; keyword: string; device: string }>;
  targetDomain: string;
  countryCode: string;
  trackDesktop: boolean;
  trackMobile: boolean;
  onBatch?: (progress: {
    tasksCompleted: number;
    tasksTotal: number;
    apiCostUsd: number;
  }) => Promise<void>;
}): Promise<{
  rows: Array<
    SerpRankResult & {
      keywordId: string;
    }
  >;
  apiCostUsd: number;
  tasksCompleted: number;
  tasksTotal: number;
}> {
  const devices: Array<'desktop' | 'mobile'> = [];
  if (input.trackDesktop) devices.push('desktop');
  if (input.trackMobile) devices.push('mobile');
  if (devices.length === 0) devices.push('desktop');

  const tasksTotal = input.keywords.length * devices.length;
  let tasksCompleted = 0;
  let apiCostUsd = 0;
  const rows: Array<SerpRankResult & { keywordId: string }> = [];

  for (const device of devices) {
    for (let i = 0; i < input.keywords.length; i += 5) {
      const batch = input.keywords.slice(i, i + 5);
      const { results, apiCostUsd: batchCost } = await fetchKeywordRanksBatch({
        keywords: batch.map((row) => row.keyword),
        targetDomain: input.targetDomain,
        countryCode: input.countryCode,
        device,
      });

      apiCostUsd += batchCost;
      tasksCompleted += batch.length;

      for (const result of results) {
        const keywordRow = batch.find((row) => row.keyword === result.keyword);
        if (!keywordRow) continue;
        rows.push({ ...result, keywordId: keywordRow.id });
      }

      await input.onBatch?.({
        tasksCompleted,
        tasksTotal,
        apiCostUsd,
      });
    }
  }

  return { rows, apiCostUsd, tasksCompleted, tasksTotal };
}
