import 'server-only';

import { dfsPost } from '~/lib/dataforseo/client';
import { getPageRanks, normaliseOprDomain } from '~/lib/openpagerank/client';
import { countryToLocationCode, deduplicateBy, normalise } from '~/lib/clusters/utils';

import type { CompetitorWithOpr, DomainKeyword, KeywordGap } from './types';

function normaliseDomain(domain: string): string {
  return domain
    .replace(/^https?:\/\//i, '')
    .replace(/^www\./i, '')
    .split('/')[0]
    ?.toLowerCase() ?? domain;
}

export async function fetchDomainOverview(
  domain: string,
  locationCode: number,
): Promise<{ keywordCount: number; etv: number }> {
  const target = normaliseDomain(domain);
  const json = await dfsPost('/dataforseo_labs/google/domain_rank_overview/live', [
    { target, location_code: locationCode, language_code: 'en' },
  ]);

  const metrics = json.tasks?.[0]?.result?.[0] as
    | { metrics?: { organic?: { count?: number; etv?: number } } }
    | undefined;

  return {
    keywordCount: metrics?.metrics?.organic?.count ?? 0,
    etv: metrics?.metrics?.organic?.etv ?? 0,
  };
}

export async function fetchDomainKeywords(
  domain: string,
  locationCode: number,
): Promise<DomainKeyword[]> {
  const target = normaliseDomain(domain);
  const json = await dfsPost('/dataforseo_labs/google/ranked_keywords/live', [
    {
      target,
      location_code: locationCode,
      language_code: 'en',
      limit: 100,
      filters: [['keyword_data.keyword_info.search_volume', '>', 100]],
    },
  ]);

  const items =
    (json.tasks?.[0]?.result?.[0] as { items?: Array<Record<string, unknown>> })
      ?.items ?? [];

  return items.map((item) => {
    const keywordData = item.keyword_data as Record<string, unknown> | undefined;
    const keywordInfo = keywordData?.keyword_info as Record<string, unknown> | undefined;
    const serpElement = item.ranked_serp_element as Record<string, unknown> | undefined;
    const serpItem = serpElement?.serp_item as Record<string, unknown> | undefined;

    return {
      keyword: String(keywordData?.keyword ?? item.keyword ?? ''),
      rank: Number(serpItem?.rank_group ?? serpItem?.rank_absolute ?? 0),
      volume: Number(keywordInfo?.search_volume ?? 0),
      url: String(serpItem?.url ?? serpItem?.relative_url ?? ''),
    };
  }).filter((row) => row.keyword);
}

export async function fetchCompetitors(
  domain: string,
  locationCode: number,
): Promise<string[]> {
  const target = normaliseDomain(domain);
  const json = await dfsPost('/dataforseo_labs/google/competitors_domain/live', [
    { target, location_code: locationCode, language_code: 'en', limit: 10 },
  ]);

  const items =
    (json.tasks?.[0]?.result?.[0] as { items?: Array<Record<string, unknown>> })
      ?.items ?? [];

  return items
    .map((item) => {
      const competitorDomain = String(item.domain ?? item.target ?? '');
      const metrics = item.metrics as { organic?: { count?: number } } | undefined;
      const organicCount = metrics?.organic?.count ?? 0;
      return { domain: competitorDomain, organicCount };
    })
    .filter((row) => row.domain && row.domain !== target)
    .sort((a, b) => b.organicCount - a.organicCount)
    .slice(0, 5)
    .map((row) => row.domain);
}

export async function enrichCompetitorsWithOpr(
  competitors: string[],
): Promise<CompetitorWithOpr[]> {
  const oprScores = await getPageRanks(competitors);

  return competitors.map((domain) => {
    const key = normaliseOprDomain(domain);
    const opr = oprScores[key];

    return {
      domain,
      opr: opr?.page_rank_integer ?? 0,
      opr_decimal: opr?.page_rank_decimal ?? 0,
    };
  });
}

export async function fetchKeywordGaps(
  targetDomain: string,
  competitorDomains: string[],
  locationCode: number,
): Promise<KeywordGap[]> {
  const target = normaliseDomain(targetDomain);
  const allGaps: KeywordGap[] = [];

  for (const competitor of competitorDomains.slice(0, 5)) {
    try {
      const json = await dfsPost('/dataforseo_labs/google/domain_intersection/live', [
        {
          target1: normaliseDomain(competitor),
          target2: target,
          location_code: locationCode,
          language_code: 'en',
          filters: [
            ['keyword_data.search_intent_info.main_intent', '=', 'informational'],
            ['keyword_data.keyword_info.search_volume', '>', 1000],
            ['first_domain_serp_element.rank_group', '<=', 20],
            ['second_domain_serp_element', '=', null],
          ],
          limit: 50,
        },
      ]);

      const items =
        (json.tasks?.[0]?.result?.[0] as { items?: Array<Record<string, unknown>> })
          ?.items ?? [];

      for (const item of items) {
        const keywordData = item.keyword_data as Record<string, unknown> | undefined;
        const keywordInfo = keywordData?.keyword_info as Record<string, unknown> | undefined;
        const keywordProps = keywordData?.keyword_properties as
          | Record<string, unknown>
          | undefined;

        allGaps.push({
          keyword: String(keywordData?.keyword ?? ''),
          volume: Number(keywordInfo?.search_volume ?? 0),
          kd: Number(keywordProps?.keyword_difficulty ?? 0),
          competitor,
        });
      }
    } catch (error) {
      console.error('[briefs] keyword gap failed for', competitor, error);
    }
  }

  return deduplicateBy(allGaps, (gap) => gap.keyword).sort(
    (a, b) => b.volume - a.volume,
  );
}

export function pickBestTopic(
  gaps: KeywordGap[],
  domainKeywords: DomainKeyword[],
): { keyword: string; reasoning: string } {
  if (gaps.length === 0) {
    throw new Error('No keyword gap opportunities found for this domain');
  }

  const domainKeywordSet = new Set(
    domainKeywords.map((row) => row.keyword.toLowerCase()),
  );
  const volumes = gaps.map((gap) => gap.volume);
  const kds = gaps.map((gap) => gap.kd);

  let best = gaps[0]!;
  let bestScore = -1;

  for (const gap of gaps) {
    const volumeScore = normalise(gap.volume, volumes) * 0.4;
    const kdScore = (1 - normalise(gap.kd, kds)) * 0.3;
    const relevanceScore =
      (domainKeywordSet.has(gap.keyword.toLowerCase()) ? 0.15 : 0) +
      (gap.kd < 40 ? 0.15 : 0);
    const score = volumeScore + kdScore + relevanceScore;

    if (score > bestScore) {
      bestScore = score;
      best = gap;
    }
  }

  return {
    keyword: best.keyword,
    reasoning: `Selected "${best.keyword}" (${best.volume}/mo, KD ${best.kd}) — best balance of volume, difficulty, and relevance vs ${best.competitor}`,
  };
}
