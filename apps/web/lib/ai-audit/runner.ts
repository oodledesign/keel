import 'server-only';

import { countryToLocationCode } from '~/lib/clusters/utils';
import {
  compareBacklinks,
  getBacklinkSummary,
  isCommonCrawlBacklinksEnabled,
} from '~/lib/commoncrawl/athena';
import { getPageRank } from '~/lib/openpagerank/client';

import { checkAiCitations, deriveBrandQueries } from './ai-citations';
import { scoreAndRecommend } from './claude-scorer';
import {
  loadContextualPromptInputs,
  sliceContextualPromptsForLlm,
} from './contextual-prompts';
import {
  crawlLlmsTxt,
  crawlPages,
  crawlRobots,
  crawlSitemap,
  normaliseDomain,
} from './crawl';
import { getAuditJob, saveAuditReport, updateAuditJobStatus } from './db';
import { AUDIT_CREDITS_ESTIMATE } from './types';
import { RUN_TIME_BUDGET_MS } from './trigger-run';

function localeToCountry(locale: string | null | undefined): string {
  if (!locale) return 'gb';
  const lower = locale.toLowerCase();
  if (lower.includes('us') || lower === 'en-us') return 'us';
  if (lower.includes('au')) return 'au';
  if (lower.includes('ca')) return 'ca';
  if (lower.includes('ie')) return 'ie';
  return 'gb';
}

export async function runAuditJob(
  jobId: string,
  projectLocale?: string | null,
  options?: { timeBudgetMs?: number },
): Promise<void> {
  const startedAt = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? RUN_TIME_BUDGET_MS;
  const deadlineMs = startedAt + timeBudgetMs;

  try {
    const job = await getAuditJob(jobId);
    const domain = normaliseDomain(job.target_domain);
    const country = localeToCountry(projectLocale);
    const locationCode = countryToLocationCode(country);

    await updateAuditJobStatus(jobId, 'crawling', {
      credits_used: AUDIT_CREDITS_ESTIMATE,
    });

    const [robotsResult, llmsTxt, sitemap] = await Promise.all([
      crawlRobots(domain),
      crawlLlmsTxt(domain),
      crawlSitemap(domain),
    ]);

    const pages = await crawlPages(domain, sitemap);

    await updateAuditJobStatus(jobId, 'extracting', {
      pages_crawled: pages.length,
    });

    await updateAuditJobStatus(jobId, 'checking_citations');

    const brandQueries = deriveBrandQueries(domain, pages);
    const contextualPrompts = await loadContextualPromptInputs({
      projectId: job.project_id,
      domain,
      pages,
      locationCode,
    });
    const contextualForLlm = sliceContextualPromptsForLlm(contextualPrompts);
    const aiCitations = await checkAiCitations(
      domain,
      brandQueries,
      locationCode,
      country,
      contextualPrompts.length
        ? { google: contextualPrompts, llm: contextualForLlm }
        : { google: [], llm: [] },
      { deadlineMs },
    );

    const [targetOpr, targetBacklinks, competitorBacklinks] = await Promise.all(
      [
        getPageRank(domain),
        getBacklinkSummary(domain, 200),
        compareBacklinks(aiCitations.competingBrands),
      ],
    );

    const backlinksEnabled = isCommonCrawlBacklinksEnabled();

    const competingBrandsOpr = aiCitations.competingBrandsOpr.map((brand) => ({
      ...brand,
      referring_domains: backlinksEnabled
        ? competitorBacklinks[brand.domain] !== undefined
          ? competitorBacklinks[brand.domain]!
          : null
        : null,
    }));

    await updateAuditJobStatus(jobId, 'scoring');

    const result = await scoreAndRecommend({
      domain,
      robotsResult,
      llmsTxt,
      sitemap,
      pages,
      aiCitations,
    });

    await saveAuditReport(
      jobId,
      job.project_id,
      domain,
      result,
      { robotsTxt: robotsResult, llmsTxt, sitemap, pages },
      {
        domainCitedInAny: aiCitations.domainCitedInAny,
        citedQueries: aiCitations.citedQueries,
        competingBrands: aiCitations.competingBrands,
        competingBrandsOpr,
        platforms: aiCitations.platforms,
        oprScore: targetOpr.page_rank_integer,
        oprDecimal: targetOpr.page_rank_decimal,
        referringDomains: backlinksEnabled
          ? targetBacklinks.referring_domains
          : null,
        topReferringDomains: backlinksEnabled
          ? targetBacklinks.top_referring_domains
          : [],
        competitorBacklinks: backlinksEnabled ? competitorBacklinks : {},
      },
    );

    await updateAuditJobStatus(jobId, 'done');
  } catch (error) {
    await updateAuditJobStatus(jobId, 'error', {
      error_msg: error instanceof Error ? error.message : 'Audit job failed',
    });
    throw error;
  }
}
