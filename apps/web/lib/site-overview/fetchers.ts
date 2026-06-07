import 'server-only';

import { countryToLocationCode } from '~/lib/clusters/utils';
import { dfsPost, isDfsAccessDenied } from '~/lib/dataforseo/client';
import { fetchDomainKeywords } from '~/lib/briefs/domain-analysis';
import { delay } from '~/lib/clusters/utils';

import { normaliseOverviewDomain, projectCountryToCode } from './domain';
import type {
  BacklinkSummaryMetrics,
  DomainRankMetrics,
  OrganicPaidMetrics,
} from './types';

function emptyOrganicPaid(): OrganicPaidMetrics {
  return { count: 0, top3: 0, etv: 0, value: 0 };
}

function parseOrganicPaid(
  block: Record<string, unknown> | undefined,
): OrganicPaidMetrics {
  if (!block) return emptyOrganicPaid();

  const pos1 = Number(block.pos_1 ?? 0);
  const pos23 = Number(block.pos_2_3 ?? 0);

  return {
    count: Number(block.count ?? 0),
    top3: pos1 + pos23,
    etv: Math.round(Number(block.etv ?? 0)),
    value: Math.round(Number(block.estimated_paid_traffic_cost ?? 0)),
  };
}

export function locationCodeForProjectCountry(country: string | null | undefined): number {
  return countryToLocationCode(projectCountryToCode(country));
}

export async function fetchDomainRankMetrics(
  domain: string,
  locationCode: number,
): Promise<DomainRankMetrics> {
  const target = normaliseOverviewDomain(domain);
  const json = await dfsPost('/dataforseo_labs/google/domain_rank_overview/live', [
    { target, location_code: locationCode, language_code: 'en' },
  ]);

  const result = json.tasks?.[0]?.result?.[0] as
    | { items?: Array<{ metrics?: Record<string, unknown> }> }
    | { metrics?: Record<string, unknown> }
    | undefined;

  const metrics =
    result && 'items' in result && result.items?.[0]?.metrics
      ? result.items[0].metrics
      : result && 'metrics' in result
        ? result.metrics
        : undefined;

  const organic = parseOrganicPaid(
    metrics?.organic as Record<string, unknown> | undefined,
  );
  const paid = parseOrganicPaid(
    metrics?.paid as Record<string, unknown> | undefined,
  );

  return { organic, paid };
}

export async function fetchLabsBulkRank(domain: string): Promise<number> {
  const target = normaliseOverviewDomain(domain);
  const json = await dfsPost('/dataforseo_labs/google/bulk_ranks/live', [
    { targets: [target] },
  ]);

  const items = (
    json.tasks?.[0]?.result?.[0] as { items?: Array<{ rank?: number }> } | undefined
  )?.items;

  const rank = Number(items?.[0]?.rank ?? 0);
  if (rank <= 0) return 0;

  return Math.min(100, Math.round(rank / 10));
}

export type BacklinkFetchResult = {
  metrics: BacklinkSummaryMetrics;
  warning?: string;
};

export async function fetchBacklinkSummary(
  domain: string,
): Promise<BacklinkFetchResult> {
  const target = normaliseOverviewDomain(domain);

  try {
    const json = await dfsPost('/backlinks/summary/live', [
      {
        target,
        include_subdomains: true,
        rank_scale: 'one_hundred',
      },
    ]);

    const summary = json.tasks?.[0]?.result?.[0] as
      | {
          rank?: number;
          referring_domains?: number;
          backlinks?: number;
          target_spam_score?: number;
          backlinks_spam_score?: number;
        }
      | undefined;

    const authorityRank = Math.round(Number(summary?.rank ?? 0));
    const spamScore = Math.round(
      Number(summary?.target_spam_score ?? summary?.backlinks_spam_score ?? 0),
    );

    return {
      metrics: {
        authorityRank,
        pageAuthority: authorityRank,
        referringDomains: Number(summary?.referring_domains ?? 0),
        backlinksCount: Number(summary?.backlinks ?? 0),
        spamScore,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (!isDfsAccessDenied(message)) {
      throw error;
    }

    const authorityRank = await fetchLabsBulkRank(domain).catch(() => 0);

    return {
      metrics: {
        authorityRank,
        pageAuthority: authorityRank,
        referringDomains: 0,
        backlinksCount: 0,
        spamScore: 0,
      },
      warning:
        authorityRank > 0
          ? 'Backlink counts need a DataForSEO Backlinks subscription — authority rank uses Labs only.'
          : 'Backlink metrics need a DataForSEO Backlinks subscription. Organic traffic metrics are still shown.',
    };
  }
}

function domainInUrls(host: string, urls: string[]): boolean {
  const needle = normaliseOverviewDomain(host);
  return urls.some((url) => {
    try {
      const parsed = new URL(url.startsWith('http') ? url : `https://${url}`);
      return normaliseOverviewDomain(parsed.hostname) === needle;
    } catch {
      return url.toLowerCase().includes(needle);
    }
  });
}

export async function countAiOverviewCitations(
  domain: string,
  locationCode: number,
  sampleSize = 8,
): Promise<number> {
  const host = normaliseOverviewDomain(domain);
  let keywords: Awaited<ReturnType<typeof fetchDomainKeywords>> = [];

  try {
    keywords = await fetchDomainKeywords(domain, locationCode);
  } catch (error) {
    console.error('[site-overview] ranked keywords fetch failed', error);
    return 0;
  }

  const sample = keywords
    .slice()
    .sort((a, b) => b.volume - a.volume)
    .slice(0, sampleSize);

  if (sample.length === 0) {
    return 0;
  }

  let count = 0;

  for (const row of sample) {
    try {
      const json = await dfsPost('/serp/google/ai_overview/live', [
        {
          keyword: row.keyword,
          location_code: locationCode,
          language_code: 'en',
        },
      ]);

      const result = json.tasks?.[0]?.result?.[0] as
        | { items?: Array<Record<string, unknown>> }
        | undefined;
      const aiOverview = result?.items?.find((item) => item.type === 'ai_overview');

      if (!aiOverview) continue;

      const references =
        (aiOverview.references as Array<{ url?: string }> | undefined) ?? [];
      const citedUrls = references
        .map((ref) => String(ref.url ?? ''))
        .filter(Boolean);

      if (domainInUrls(host, citedUrls)) {
        count += 1;
      }
    } catch (error) {
      console.error('[site-overview] ai overview check failed', row.keyword, error);
    }

    await delay(200);
  }

  return count;
}
