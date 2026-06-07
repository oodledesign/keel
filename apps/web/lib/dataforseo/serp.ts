import 'server-only';

import { dfsPost } from './client';
import type { ClusterDraft, ClusterKeyword, SerpCache } from '../clusters/types';
import {
  countryToLocationCode,
  delay,
  groupBy,
  normaliseUrl,
} from '../clusters/utils';

export function overlapScore(urlsA: string[], urlsB: string[]): number {
  const setA = new Set(urlsA);
  return urlsB.filter((url) => setA.has(url)).length;
}

export async function fetchSerpsForKeywords(
  keywords: string[],
  country: string,
): Promise<SerpCache> {
  const locationCode = countryToLocationCode(country);
  const cache: SerpCache = {};

  for (let i = 0; i < keywords.length; i += 5) {
    const batch = keywords.slice(i, i + 5);
    const tasks = batch.map((keyword) => ({
      keyword,
      location_code: locationCode,
      language_code: 'en',
      device: 'desktop',
      os: 'windows',
      depth: 10,
    }));

    const results = await dfsPost('/serp/google/organic/live/advanced', tasks);

    for (const task of results.tasks ?? []) {
      const kw = task.data?.keyword as string | undefined;
      const items = task.result?.[0]?.items;
      const urls = Array.isArray(items)
        ? items
            .filter((item) => (item as { type?: string }).type === 'organic')
            .map((item) => normaliseUrl(String((item as { url?: string }).url ?? '')))
            .filter(Boolean)
        : [];

      if (kw) {
        cache[kw] = urls;
      }
    }

    await delay(200);
  }

  return cache;
}

export function buildClusters(
  keywords: ClusterKeyword[],
  serpCache: SerpCache,
): ClusterDraft[] {
  const byIntent = groupBy(keywords, (keyword) => keyword.intent);
  const clusters: ClusterDraft[] = [];

  for (const [intent, group] of Object.entries(byIntent)) {
    const assigned = new Set<string>();

    for (const kw of group) {
      if (assigned.has(kw.keyword)) continue;

      const cluster: ClusterDraft = {
        id: crypto.randomUUID(),
        name: kw.keyword,
        keywords: [kw],
        dominantIntent: kw.intent,
      };

      for (const other of group) {
        if (other.keyword === kw.keyword || assigned.has(other.keyword)) {
          continue;
        }

        const score = overlapScore(
          serpCache[kw.keyword] ?? [],
          serpCache[other.keyword] ?? [],
        );

        if (score >= 4) {
          cluster.keywords.push(other);
          assigned.add(other.keyword);
        }
      }

      assigned.add(kw.keyword);
      clusters.push(cluster);
    }
  }

  return clusters.slice(0, 10);
}

export function mergeHighOverlapKeywords(
  clusters: ClusterDraft[],
  serpCache: SerpCache,
): ClusterDraft[] {
  const merged: ClusterDraft[] = [];
  const consumed = new Set<string>();

  for (const cluster of clusters) {
    if (consumed.has(cluster.id)) continue;

    const current = structuredClone(cluster);
    consumed.add(cluster.id);

    for (const other of clusters) {
      if (consumed.has(other.id)) continue;

      const primaryA = current.keywords[0]?.keyword;
      const primaryB = other.keywords[0]?.keyword;
      if (!primaryA || !primaryB) continue;

      const score = overlapScore(
        serpCache[primaryA] ?? [],
        serpCache[primaryB] ?? [],
      );

      if (score >= 7) {
        current.keywords.push(...other.keywords);
        current.name = current.keywords
          .slice()
          .sort((a, b) => b.search_volume - a.search_volume)[0]?.keyword ?? current.name;
        consumed.add(other.id);
      }
    }

    merged.push(current);
  }

  return merged;
}
