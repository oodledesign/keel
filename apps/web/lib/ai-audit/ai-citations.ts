import 'server-only';

import { delay } from '~/lib/clusters/utils';
import { dfsPost, type DfsResponse } from '~/lib/dataforseo/client';

import { normaliseDomain } from './crawl';
import type {
  AiCitationResult,
  CitationCheck,
  CitationPlatform,
  PageCrawl,
  PlatformCitationResult,
} from './types';
import {
  CITATION_PLATFORM_LABELS,
  CITATION_QUERIES_GOOGLE,
  CITATION_QUERIES_LLM,
} from './types';

const COUNTRY_ISO: Record<string, string> = {
  gb: 'GB',
  us: 'US',
  au: 'AU',
  ca: 'CA',
  ie: 'IE',
  nz: 'NZ',
  za: 'ZA',
};

type LlmPlatformConfig = {
  platform: CitationPlatform;
  path: string;
  model_name: string;
  web_search: boolean;
  force_web_search?: boolean;
};

const LLM_PLATFORMS: LlmPlatformConfig[] = [
  {
    platform: 'chatgpt',
    path: '/ai_optimization/chat_gpt/llm_responses/live',
    model_name: 'gpt-4.1-mini',
    web_search: true,
    force_web_search: true,
  },
  {
    platform: 'perplexity',
    path: '/ai_optimization/perplexity/llm_responses/live',
    model_name: 'sonar',
    web_search: true,
  },
  {
    platform: 'claude',
    path: '/ai_optimization/claude/llm_responses/live',
    model_name: 'claude-sonnet-4-20250514',
    web_search: true,
    force_web_search: true,
  },
];

export function deriveBrandQueries(domain: string, pages: PageCrawl[]): string[] {
  const host = normaliseDomain(domain);
  const homepage =
    pages.find((page) => {
      try {
        const pathname = new URL(page.url).pathname;
        return pathname === '/' || pathname === '';
      } catch {
        return false;
      }
    }) ?? pages[0];

  if (!homepage) {
    return [`${host.split('.')[0]} services`];
  }

  const orgSchema = homepage.jsonLd.find(
    (block) => block.type === 'Organization' || block.type === 'LocalBusiness',
  );
  const orgName =
    typeof orgSchema?.raw?.name === 'string' ? orgSchema.raw.name : undefined;

  const serviceTerms = homepage.h2s
    .slice(0, 5)
    .map((heading) => heading.toLowerCase().replace(/[^a-z\s]/g, '').trim())
    .filter((heading) => heading.length > 5);

  const queries: string[] = [];
  if (orgName) queries.push(orgName);

  const domainSlug = host.split('.')[0] ?? host;
  queries.push(`${domainSlug} services`);
  if (serviceTerms[0]) queries.push(serviceTerms[0]);
  if (serviceTerms[1]) queries.push(serviceTerms[1]);
  if (serviceTerms[0]) queries.push(`best ${serviceTerms[0]} uk`);

  return [...new Set(queries)].slice(0, CITATION_QUERIES_GOOGLE);
}

function countryToIso(country: string): string {
  return COUNTRY_ISO[country.toLowerCase()] ?? 'GB';
}

function domainInUrls(host: string, urls: string[]): boolean {
  return urls.some((url) => url.toLowerCase().includes(host));
}

function addCompetingBrands(
  host: string,
  urls: string[],
  competingBrands: Set<string>,
): void {
  for (const url of urls) {
    try {
      const cited = new URL(url).hostname.replace(/^www\./i, '').toLowerCase();
      if (!cited.includes(host)) competingBrands.add(cited);
    } catch {
      // ignore invalid URLs
    }
  }
}

function extractLlmAnnotationUrls(
  result: Record<string, unknown> | undefined,
): string[] {
  const items = (result?.items as Array<Record<string, unknown>>) ?? [];
  const urls: string[] = [];

  for (const item of items) {
    const sections = item.sections as Array<Record<string, unknown>> | undefined;
    for (const section of sections ?? []) {
      const annotations = section.annotations as
        | Array<{ url?: string }>
        | undefined;
      for (const annotation of annotations ?? []) {
        if (annotation.url) urls.push(String(annotation.url));
      }
    }
  }

  return [...new Set(urls)];
}

async function checkGoogleAiOverview(
  host: string,
  queries: string[],
  locationCode: number,
  competingBrands: Set<string>,
): Promise<PlatformCitationResult> {
  const citations: CitationCheck[] = [];

  for (const query of queries) {
    try {
      const json = await dfsPost('/serp/google/ai_overview/live', [
        { keyword: query, location_code: locationCode, language_code: 'en' },
      ]);

      const result = json.tasks?.[0]?.result?.[0] as
        | { items?: Array<Record<string, unknown>> }
        | undefined;
      const items = result?.items ?? [];
      const aiOverview = items.find((item) => item.type === 'ai_overview');

      if (!aiOverview) {
        citations.push({
          query,
          triggered: false,
          domainCited: false,
          citedUrls: [],
        });
        continue;
      }

      const references =
        (aiOverview.references as Array<{ url?: string }> | undefined) ?? [];
      const citedUrls = references
        .map((ref) => String(ref.url ?? ''))
        .filter(Boolean);
      addCompetingBrands(host, citedUrls, competingBrands);

      citations.push({
        query,
        triggered: true,
        domainCited: domainInUrls(host, citedUrls),
        citedUrls,
      });
    } catch {
      citations.push({
        query,
        triggered: false,
        domainCited: false,
        citedUrls: [],
      });
    }

    await delay(200);
  }

  const citedQueries = citations
    .filter((citation) => citation.domainCited)
    .map((citation) => citation.query);

  return {
    platform: 'google_ai_overview',
    label: CITATION_PLATFORM_LABELS.google_ai_overview,
    domainCitedInAny: citedQueries.length > 0,
    citedQueries,
    citations,
  };
}

async function checkLlmPlatform(
  config: LlmPlatformConfig,
  host: string,
  queries: string[],
  countryIso: string,
  competingBrands: Set<string>,
): Promise<PlatformCitationResult> {
  const citations: CitationCheck[] = [];

  for (const query of queries) {
    try {
      const body: Record<string, unknown> = {
        user_prompt: query.slice(0, 500),
        model_name: config.model_name,
        web_search: config.web_search,
        max_output_tokens: 512,
      };

      if (config.force_web_search) {
        body.force_web_search = true;
      }

      if (config.platform === 'chatgpt' || config.platform === 'claude') {
        body.web_search_country_iso_code = countryIso;
      }

      const json = (await dfsPost(config.path, [body])) as DfsResponse;
      const result = json.tasks?.[0]?.result?.[0] as
        | Record<string, unknown>
        | undefined;

      const citedUrls = extractLlmAnnotationUrls(result);
      const triggered = Boolean(result?.web_search) || citedUrls.length > 0;

      if (citedUrls.length) {
        addCompetingBrands(host, citedUrls, competingBrands);
      }

      citations.push({
        query,
        triggered,
        domainCited: domainInUrls(host, citedUrls),
        citedUrls,
      });
    } catch {
      citations.push({
        query,
        triggered: false,
        domainCited: false,
        citedUrls: [],
      });
    }

    await delay(400);
  }

  const citedQueries = citations
    .filter((citation) => citation.domainCited)
    .map((citation) => citation.query);

  return {
    platform: config.platform,
    label: CITATION_PLATFORM_LABELS[config.platform],
    domainCitedInAny: citedQueries.length > 0,
    citedQueries,
    citations,
  };
}

export async function checkAiCitations(
  domain: string,
  brandQueries: string[],
  locationCode: number,
  country = 'gb',
): Promise<AiCitationResult> {
  const host = normaliseDomain(domain);
  const countryIso = countryToIso(country);
  const competingBrands = new Set<string>();

  const googleQueries = brandQueries.slice(0, CITATION_QUERIES_GOOGLE);
  const llmQueries = brandQueries.slice(0, CITATION_QUERIES_LLM);

  const google = await checkGoogleAiOverview(
    host,
    googleQueries,
    locationCode,
    competingBrands,
  );

  const llmResults: PlatformCitationResult[] = [];
  for (const config of LLM_PLATFORMS) {
    llmResults.push(
      await checkLlmPlatform(config, host, llmQueries, countryIso, competingBrands),
    );
  }

  const platforms = [google, ...llmResults];
  const allCitations = platforms.flatMap((platform) => platform.citations);
  const citedQueries = [
    ...new Set(platforms.flatMap((platform) => platform.citedQueries)),
  ];

  return {
    platforms,
    citations: allCitations,
    domainCitedInAny: platforms.some((platform) => platform.domainCitedInAny),
    citedQueries,
    competingBrands: [...competingBrands],
  };
}
