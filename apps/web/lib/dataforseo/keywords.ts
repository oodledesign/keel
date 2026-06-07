import 'server-only';

import { dfsPost } from './client';
import type { ClusterKeyword, KeywordIntent } from '../clusters/types';
import {
  countryToLocationCode,
  deduplicateBy,
  delay,
} from '../clusters/utils';

function parseIntent(raw: unknown): KeywordIntent {
  const value = String(raw ?? 'informational').toLowerCase();
  if (
    value === 'commercial' ||
    value === 'transactional' ||
    value === 'navigational'
  ) {
    return value;
  }
  return 'informational';
}

function parseKeywordItem(item: Record<string, unknown>): ClusterKeyword | null {
  const keyword =
    (item.keyword as string | undefined) ??
    (item.keyword_data as { keyword?: string } | undefined)?.keyword;

  if (!keyword?.trim()) return null;

  const keywordInfo =
    (item.keyword_info as Record<string, unknown> | undefined) ?? item;
  const keywordProps =
    (item.keyword_properties as Record<string, unknown> | undefined) ?? item;
  const intentInfo =
    (item.search_intent_info as Record<string, unknown> | undefined) ?? {};

  return {
    keyword: keyword.trim(),
    search_volume: Number(keywordInfo.search_volume ?? item.search_volume ?? 0),
    keyword_difficulty: Number(
      keywordProps.keyword_difficulty ?? item.keyword_difficulty ?? 0,
    ),
    cpc: Number(keywordInfo.cpc ?? item.cpc ?? 0),
    intent: parseIntent(intentInfo.main_intent ?? item.intent),
  };
}

function parseKeywordsFromResponse(response: {
  tasks?: Array<{ result?: Array<Record<string, unknown>> }>;
}): ClusterKeyword[] {
  const items = response.tasks?.[0]?.result?.[0]?.items;
  if (!Array.isArray(items)) return [];

  return items
    .map((item) => parseKeywordItem(item as Record<string, unknown>))
    .filter((item): item is ClusterKeyword => item !== null);
}

function parseRelatedKeywords(response: {
  tasks?: Array<{ result?: Array<Record<string, unknown>> }>;
}): ClusterKeyword[] {
  const resultItems = response.tasks?.[0]?.result ?? [];
  const keywords: ClusterKeyword[] = [];

  for (const block of resultItems) {
    const items = block.items;
    if (Array.isArray(items)) {
      for (const item of items) {
        const parsed = parseKeywordItem(item as Record<string, unknown>);
        if (parsed) keywords.push(parsed);
      }
    }

    const nested = block.items as Array<Record<string, unknown>> | undefined;
    if (Array.isArray(nested)) {
      for (const entry of nested) {
        const data = entry.keyword_data as Record<string, unknown> | undefined;
        if (data) {
          const parsed = parseKeywordItem({ ...entry, ...data });
          if (parsed) keywords.push(parsed);
        }
      }
    }
  }

  return keywords;
}

export async function expandSeeds(
  seeds: string[],
  country: string,
): Promise<ClusterKeyword[]> {
  const locationCode = countryToLocationCode(country);
  const all: ClusterKeyword[] = [];

  for (const seed of seeds) {
    const related = await dfsPost(
      '/dataforseo_labs/google/related_keywords/live',
      [
        {
          keyword: seed,
          location_code: locationCode,
          language_code: 'en',
          limit: 100,
        },
      ],
    );
    all.push(...parseRelatedKeywords(related));

    const suggestions = await dfsPost(
      '/dataforseo_labs/google/keyword_suggestions/live',
      [
        {
          keyword: seed,
          location_code: locationCode,
          language_code: 'en',
          limit: 100,
        },
      ],
    );
    all.push(...parseKeywordsFromResponse(suggestions));

    const adsRelated = await dfsPost(
      '/keywords_data/google_ads/keywords_for_keywords/live',
      [
        {
          keywords: [seed],
          location_code: locationCode,
          language_code: 'en',
        },
      ],
    );
    all.push(...parseKeywordsFromResponse(adsRelated));

    await delay(150);
  }

  for (const seed of seeds) {
    all.push({
      keyword: seed,
      search_volume: 0,
      keyword_difficulty: 0,
      cpc: 0,
      intent: 'informational',
    });
  }

  return deduplicateBy(all, (item) => item.keyword);
}

export function filterCandidates(
  candidates: ClusterKeyword[],
  minVolume: number,
  maxKd: number,
  excludedBrandTerms: string[] = [],
): ClusterKeyword[] {
  const brands = excludedBrandTerms.map((term) => term.toLowerCase().trim());

  return candidates.filter((keyword) => {
    if (keyword.search_volume < minVolume) return false;
    if (keyword.keyword_difficulty > maxKd) return false;
    const lower = keyword.keyword.toLowerCase();
    if (brands.some((brand) => brand && lower.includes(brand))) return false;
    return true;
  });
}

export function estimateSerpCredits(candidateCount: number): number {
  return candidateCount * 5;
}
