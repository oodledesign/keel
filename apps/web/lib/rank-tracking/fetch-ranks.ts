import 'server-only';

import { countryToLocationCode } from '~/lib/clusters/utils';
import { type DfsResponse, dfsPost } from '~/lib/dataforseo/client';
import { normaliseOverviewDomain } from '~/lib/site-overview/domain';

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

function parseSerpItems(
  result: Record<string, unknown> | undefined,
): Array<Record<string, unknown>> {
  const items = result?.items;
  return Array.isArray(items) ? (items as Array<Record<string, unknown>>) : [];
}

export function parseKeywordRankFromSerp(
  items: Array<Record<string, unknown>>,
  targetDomain: string,
): Pick<
  SerpRankResult,
  'position' | 'rankingUrl' | 'aiOverviewPresent' | 'serpFeatures'
> {
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

  if (input.keywords.length !== 1) {
    throw new Error('fetchKeywordRanksBatch accepts one keyword at a time');
  }

  const keyword = input.keywords[0]!;
  const locationCode = countryToLocationCode(input.countryCode);

  const json = await dfsPost<DfsResponse>(
    '/serp/google/organic/live/advanced',
    [
      {
        keyword,
        location_code: locationCode,
        language_code: 'en',
        device: input.device,
        os: input.device === 'mobile' ? 'android' : 'windows',
        depth: input.depth ?? 100,
      },
    ],
  );
  const apiCostUsd = extractApiCost(json);
  const results: SerpRankResult[] = [];

  for (const task of json.tasks ?? []) {
    const taskKeyword = String(task.data?.keyword ?? keyword);
    const parsed = parseKeywordRankFromSerp(
      parseSerpItems(task.result?.[0] as Record<string, unknown> | undefined),
      input.targetDomain,
    );

    results.push({
      keyword: taskKeyword,
      device: input.device,
      ...parsed,
      apiCostUsd: extractApiCost({ tasks: [task] }),
    });
  }

  return { results, apiCostUsd };
}

export type RankTask = {
  keywordId: string;
  keyword: string;
  device: 'desktop' | 'mobile';
};

export function buildRankTasks(input: {
  keywords: Array<{ id: string; keyword: string }>;
  trackDesktop: boolean;
  trackMobile: boolean;
}): RankTask[] {
  const devices: Array<'desktop' | 'mobile'> = [];
  if (input.trackDesktop) devices.push('desktop');
  if (input.trackMobile) devices.push('mobile');
  if (devices.length === 0) devices.push('desktop');

  const tasks: RankTask[] = [];
  for (const device of devices) {
    for (const keyword of input.keywords) {
      tasks.push({
        keywordId: keyword.id,
        keyword: keyword.keyword,
        device,
      });
    }
  }
  return tasks;
}

export async function fetchKeywordRanksFromTasks(input: {
  tasks: RankTask[];
  startIndex: number;
  targetDomain: string;
  countryCode: string;
  timeBudgetMs?: number;
  onBatch: (batch: {
    rows: Array<SerpRankResult & { keywordId: string }>;
    tasksCompleted: number;
    tasksTotal: number;
    sessionApiCostUsd: number;
  }) => Promise<void>;
}): Promise<{
  tasksCompleted: number;
  sessionApiCostUsd: number;
  completed: boolean;
}> {
  const startTime = Date.now();
  const tasksTotal = input.tasks.length;
  let sessionApiCostUsd = 0;
  let i = input.startIndex;

  while (i < input.tasks.length) {
    if (
      input.timeBudgetMs != null &&
      Date.now() - startTime > input.timeBudgetMs
    ) {
      break;
    }

    const task = input.tasks[i]!;
    i += 1;

    const { results, apiCostUsd: batchCost } = await fetchKeywordRanksBatch({
      keywords: [task.keyword],
      targetDomain: input.targetDomain,
      countryCode: input.countryCode,
      device: task.device,
    });

    sessionApiCostUsd += batchCost;

    const rows: Array<SerpRankResult & { keywordId: string }> = [];
    for (const result of results) {
      rows.push({ ...result, keywordId: task.keywordId });
    }

    await input.onBatch({
      rows,
      tasksCompleted: i,
      tasksTotal,
      sessionApiCostUsd,
    });
  }

  return {
    tasksCompleted: i,
    sessionApiCostUsd,
    completed: i >= input.tasks.length,
  };
}

/** @deprecated Prefer fetchKeywordRanksFromTasks for resumable rank checks. */
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
  const tasks = buildRankTasks({
    keywords: input.keywords.map((row) => ({
      id: row.id,
      keyword: row.keyword,
    })),
    trackDesktop: input.trackDesktop,
    trackMobile: input.trackMobile,
  });

  const rows: Array<SerpRankResult & { keywordId: string }> = [];
  let apiCostUsd = 0;

  const { tasksCompleted, sessionApiCostUsd } =
    await fetchKeywordRanksFromTasks({
      tasks,
      startIndex: 0,
      targetDomain: input.targetDomain,
      countryCode: input.countryCode,
      onBatch: async (batch) => {
        apiCostUsd = batch.sessionApiCostUsd;
        rows.push(...batch.rows);
        await input.onBatch?.({
          tasksCompleted: batch.tasksCompleted,
          tasksTotal: batch.tasksTotal,
          apiCostUsd: batch.sessionApiCostUsd,
        });
      },
    });

  return {
    rows,
    apiCostUsd: sessionApiCostUsd || apiCostUsd,
    tasksCompleted,
    tasksTotal: tasks.length,
  };
}
