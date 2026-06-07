import 'server-only';

import { countryToLocationCode } from '~/lib/clusters/utils';

import { checkAiCitations, deriveBrandQueries } from './ai-citations';
import { scoreAndRecommend } from './claude-scorer';
import {
  crawlLlmsTxt,
  crawlPages,
  crawlRobots,
  crawlSitemap,
  normaliseDomain,
} from './crawl';
import {
  getAuditJob,
  saveAuditReport,
  updateAuditJobStatus,
} from './db';
import { AUDIT_CREDITS_ESTIMATE } from './types';

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
): Promise<void> {
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
    const aiCitations = await checkAiCitations(
      domain,
      brandQueries,
      locationCode,
      country,
    );

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
        platforms: aiCitations.platforms,
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
