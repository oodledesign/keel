import 'server-only';

import { delay } from '~/lib/clusters/utils';
import { type DfsResponse, dfsPost } from '~/lib/dataforseo/client';
import { getPageRanks, normaliseOprDomain } from '~/lib/openpagerank/client';

import { normaliseDomain } from './crawl';
import type {
  AiCitationResult,
  CitationCheck,
  CitationPlatform,
  CitationRunSample,
  PageCrawl,
  PlatformCitationResult,
  PromptLayer,
} from './types';
import {
  CITATION_PLATFORM_LABELS,
  CITATION_QUERIES_GOOGLE,
  CITATION_QUERIES_LLM,
  CITATION_SAMPLE_RUNS,
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
    model_name: 'claude-sonnet-4-6',
    web_search: true,
    force_web_search: true,
  },
];

export function deriveBrandQueries(
  domain: string,
  pages: PageCrawl[],
): string[] {
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
    .map((heading) =>
      heading
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .trim(),
    )
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
    const sections = item.sections as
      | Array<Record<string, unknown>>
      | undefined;
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

function aggregateSampleRuns(
  query: string,
  promptLayer: PromptLayer,
  runs: CitationRunSample[],
): CitationCheck {
  const sampleCount = runs.length;
  const citedRuns = runs.filter((run) => run.domainCited).length;
  const presenceRate =
    sampleCount > 0 ? Math.round((citedRuns / sampleCount) * 100) : 0;

  return {
    query,
    promptLayer,
    triggered: runs.some((run) => run.triggered),
    domainCited: citedRuns > 0,
    presenceRate,
    sampleCount,
    runs,
    citedUrls: [...new Set(runs.flatMap((run) => run.citedUrls))],
  };
}

function summarisePlatform(
  platform: CitationPlatform,
  promptLayer: PromptLayer,
  citations: CitationCheck[],
): PlatformCitationResult {
  const citedQueries = citations
    .filter((citation) => citation.domainCited)
    .map((citation) => citation.query);
  const averagePresenceRate =
    citations.length > 0
      ? Math.round(
          citations.reduce(
            (sum, citation) => sum + (citation.presenceRate ?? 0),
            0,
          ) / citations.length,
        )
      : 0;

  return {
    platform,
    label: CITATION_PLATFORM_LABELS[platform],
    promptLayer,
    domainCitedInAny: citedQueries.length > 0,
    citedQueries,
    citations,
    averagePresenceRate,
  };
}

async function sampleGoogleAiOverviewQuery(
  host: string,
  query: string,
  locationCode: number,
  competingBrands: Set<string>,
): Promise<CitationRunSample[]> {
  const runs: CitationRunSample[] = [];

  for (let index = 0; index < CITATION_SAMPLE_RUNS; index += 1) {
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
        runs.push({ triggered: false, domainCited: false, citedUrls: [] });
      } else {
        const references =
          (aiOverview.references as Array<{ url?: string }> | undefined) ?? [];
        const citedUrls = references
          .map((ref) => String(ref.url ?? ''))
          .filter(Boolean);
        addCompetingBrands(host, citedUrls, competingBrands);
        runs.push({
          triggered: true,
          domainCited: domainInUrls(host, citedUrls),
          citedUrls,
        });
      }
    } catch {
      runs.push({ triggered: false, domainCited: false, citedUrls: [] });
    }

    await delay(200);
  }

  return runs;
}

async function checkGoogleAiOverview(
  host: string,
  queries: string[],
  locationCode: number,
  competingBrands: Set<string>,
  promptLayer: PromptLayer,
): Promise<PlatformCitationResult> {
  const citations: CitationCheck[] = [];

  for (const query of queries) {
    const runs = await sampleGoogleAiOverviewQuery(
      host,
      query,
      locationCode,
      competingBrands,
    );
    citations.push(aggregateSampleRuns(query, promptLayer, runs));
  }

  return summarisePlatform('google_ai_overview', promptLayer, citations);
}

async function sampleLlmQuery(
  config: LlmPlatformConfig,
  host: string,
  query: string,
  countryIso: string,
  competingBrands: Set<string>,
): Promise<CitationRunSample[]> {
  const runs: CitationRunSample[] = [];

  for (let index = 0; index < CITATION_SAMPLE_RUNS; index += 1) {
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

      runs.push({
        triggered,
        domainCited: domainInUrls(host, citedUrls),
        citedUrls,
      });
    } catch {
      runs.push({ triggered: false, domainCited: false, citedUrls: [] });
    }

    await delay(400);
  }

  return runs;
}

async function checkLlmPlatform(
  config: LlmPlatformConfig,
  host: string,
  queries: string[],
  countryIso: string,
  competingBrands: Set<string>,
  promptLayer: PromptLayer,
): Promise<PlatformCitationResult> {
  const citations: CitationCheck[] = [];

  for (const query of queries) {
    const runs = await sampleLlmQuery(
      config,
      host,
      query,
      countryIso,
      competingBrands,
    );
    citations.push(aggregateSampleRuns(query, promptLayer, runs));
  }

  return summarisePlatform(config.platform, promptLayer, citations);
}

function platformKey(
  platform: CitationPlatform,
  promptLayer: PromptLayer,
): string {
  return `${platform}:${promptLayer}`;
}

async function runCitationLayer(
  host: string,
  genericQueries: string[],
  contextualGoogleQueries: string[],
  contextualLlmQueries: string[],
  locationCode: number,
  countryIso: string,
  competingBrands: Set<string>,
  options?: {
    deadlineMs?: number;
    existingPlatforms?: PlatformCitationResult[];
  },
): Promise<{ platforms: PlatformCitationResult[]; truncated: boolean }> {
  const platforms: PlatformCitationResult[] = [
    ...(options?.existingPlatforms ?? []),
  ];
  const done = new Set(
    platforms.map((row) =>
      platformKey(row.platform, row.promptLayer ?? 'generic'),
    ),
  );
  let truncated = false;
  const deadlineMs = options?.deadlineMs;
  const pastDeadline = () => deadlineMs != null && Date.now() >= deadlineMs;

  const pushIfNew = async (
    key: string,
    run: () => Promise<PlatformCitationResult>,
  ) => {
    if (done.has(key)) return;
    if (pastDeadline()) {
      truncated = true;
      return;
    }
    const result = await run();
    platforms.push(result);
    done.add(key);
  };

  const googleGeneric = genericQueries.slice(0, CITATION_QUERIES_GOOGLE);
  if (googleGeneric.length) {
    await pushIfNew(platformKey('google_ai_overview', 'generic'), () =>
      checkGoogleAiOverview(
        host,
        googleGeneric,
        locationCode,
        competingBrands,
        'generic',
      ),
    );
  }

  if (contextualGoogleQueries.length) {
    await pushIfNew(platformKey('google_ai_overview', 'contextual'), () =>
      checkGoogleAiOverview(
        host,
        contextualGoogleQueries,
        locationCode,
        competingBrands,
        'contextual',
      ),
    );
  }

  const llmGeneric = genericQueries.slice(0, CITATION_QUERIES_LLM);
  for (const config of LLM_PLATFORMS) {
    if (llmGeneric.length) {
      await pushIfNew(platformKey(config.platform, 'generic'), () =>
        checkLlmPlatform(
          config,
          host,
          llmGeneric,
          countryIso,
          competingBrands,
          'generic',
        ),
      );
      if (truncated) break;
    }

    if (contextualLlmQueries.length) {
      await pushIfNew(platformKey(config.platform, 'contextual'), () =>
        checkLlmPlatform(
          config,
          host,
          contextualLlmQueries,
          countryIso,
          competingBrands,
          'contextual',
        ),
      );
      if (truncated) break;
    }
  }

  return { platforms, truncated };
}

export async function checkAiCitations(
  domain: string,
  brandQueries: string[],
  locationCode: number,
  country = 'gb',
  contextualQueries: { google: string[]; llm: string[] } = {
    google: [],
    llm: [],
  },
  options?: {
    deadlineMs?: number;
    existingPlatforms?: PlatformCitationResult[];
    existingCompetingBrands?: string[];
  },
): Promise<AiCitationResult> {
  const host = normaliseDomain(domain);
  const countryIso = countryToIso(country);
  const competingBrands = new Set<string>(
    options?.existingCompetingBrands ?? [],
  );

  const { platforms, truncated } = await runCitationLayer(
    host,
    brandQueries,
    contextualQueries.google,
    contextualQueries.llm,
    locationCode,
    countryIso,
    competingBrands,
    {
      deadlineMs: options?.deadlineMs,
      existingPlatforms: options?.existingPlatforms,
    },
  );

  const allCitations = platforms.flatMap((platform) => platform.citations);
  const citedQueries = [
    ...new Set(platforms.flatMap((platform) => platform.citedQueries)),
  ];
  const competingBrandList = [...competingBrands];
  const oprScores = await getPageRanks(competingBrandList);

  return {
    platforms,
    citations: allCitations,
    domainCitedInAny: platforms.some((platform) => platform.domainCitedInAny),
    citedQueries,
    competingBrands: competingBrandList,
    competingBrandsOpr: competingBrandList.map((brand) => {
      const key = normaliseOprDomain(brand);
      const opr = oprScores[key];

      return {
        domain: brand,
        opr: opr?.page_rank_integer ?? 0,
        opr_decimal: opr?.page_rank_decimal ?? 0,
      };
    }),
    truncated,
  };
}

export function platformPromptLayer(
  platform: PlatformCitationResult,
): PromptLayer {
  return platform.promptLayer ?? 'generic';
}

export function filterPlatformsByLayer(
  platforms: PlatformCitationResult[],
  layer: PromptLayer,
): PlatformCitationResult[] {
  return platforms.filter(
    (platform) => platformPromptLayer(platform) === layer,
  );
}
