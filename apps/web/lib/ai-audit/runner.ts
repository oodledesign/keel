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
import {
  getAuditJob,
  heartbeatAuditJob,
  parseAuditJobProgress,
  releaseAuditJobClaim,
  saveAuditJobProgress,
  saveAuditReport,
  tryClaimAuditJobRun,
  updateAuditJobStatus,
} from './db';
import { AUDIT_SCORING_RESERVE_MS, RUN_TIME_BUDGET_MS } from './trigger-run';
import type { AuditJobProgress, AuditRunResult } from './types';
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

function remainingMs(deadlineMs: number): number {
  return deadlineMs - Date.now();
}

/**
 * Runs one worker slice of an AI audit. Checkpoints crawl + citations so a
 * subsequent invocation can finish scoring without thinning the report.
 */
export async function runAuditJob(
  jobId: string,
  projectLocale?: string | null,
  options?: { timeBudgetMs?: number },
): Promise<AuditRunResult> {
  const claim = await tryClaimAuditJobRun(jobId);
  if (claim === 'done') return { completed: true };
  if (claim === 'error') return { completed: true };
  if (claim === 'busy') return { completed: false, alreadyRunning: true };

  const startedAt = Date.now();
  const timeBudgetMs = options?.timeBudgetMs ?? RUN_TIME_BUDGET_MS;
  const deadlineMs = startedAt + timeBudgetMs;

  try {
    const job = await getAuditJob(jobId);
    const domain = normaliseDomain(job.target_domain);
    const country = localeToCountry(projectLocale);
    const locationCode = countryToLocationCode(country);

    let progress: AuditJobProgress = parseAuditJobProgress(job.progress) ?? {
      version: 1,
    };

    // --- Phase 1: crawl -------------------------------------------------
    if (!progress.crawl) {
      await updateAuditJobStatus(jobId, 'crawling', {
        credits_used: AUDIT_CREDITS_ESTIMATE,
      });

      const [robotsResult, llmsTxt, sitemap] = await Promise.all([
        crawlRobots(domain),
        crawlLlmsTxt(domain),
        crawlSitemap(domain),
      ]);

      await heartbeatAuditJob(jobId);
      const pages = await crawlPages(domain, sitemap);

      progress = {
        version: 1,
        crawl: { robotsTxt: robotsResult, llmsTxt, sitemap, pages },
      };

      await saveAuditJobProgress(jobId, progress, 'extracting');
      await updateAuditJobStatus(jobId, 'checking_citations', {
        pages_crawled: pages.length,
      });

      // Give citations a fresh worker when little time remains.
      if (remainingMs(deadlineMs) < AUDIT_SCORING_RESERVE_MS + 60_000) {
        await releaseAuditJobClaim(jobId);
        return { completed: false };
      }
    }

    const crawl = progress.crawl!;

    // --- Phase 2: citations + authority signals -------------------------
    if (!progress.citationBundle) {
      await updateAuditJobStatus(jobId, 'checking_citations', {
        pages_crawled: crawl.pages.length,
      });

      // Prefer a full citation pass — chain to next worker if budget is tight.
      if (remainingMs(deadlineMs) < AUDIT_SCORING_RESERVE_MS + 45_000) {
        await releaseAuditJobClaim(jobId);
        return { completed: false };
      }

      const brandQueries = deriveBrandQueries(domain, crawl.pages);
      const contextualPrompts = await loadContextualPromptInputs({
        projectId: job.project_id,
        domain,
        pages: crawl.pages,
        locationCode,
      });
      const contextualForLlm = sliceContextualPromptsForLlm(contextualPrompts);

      await heartbeatAuditJob(jobId);

      // Use almost the whole remaining budget for citations; scoring gets its
      // own invocation when we run out of time after this phase.
      const citationDeadline = Math.min(
        deadlineMs - 15_000,
        Date.now() + Math.max(remainingMs(deadlineMs) - 20_000, 30_000),
      );

      // Full citation budget for this slice — do not thin sample counts.
      const aiCitations = await checkAiCitations(
        domain,
        brandQueries,
        locationCode,
        country,
        contextualPrompts.length
          ? { google: contextualPrompts, llm: contextualForLlm }
          : { google: [], llm: [] },
        {
          deadlineMs: citationDeadline,
          existingPlatforms: progress.citationPartial?.platforms,
          existingCompetingBrands:
            progress.citationPartial?.competingBrandDomains,
        },
      );

      await heartbeatAuditJob(jobId);

      // Incomplete pass: checkpoint finished platforms and continue next worker.
      if (aiCitations.truncated) {
        console.warn(
          '[rankly] ai-audit citations truncated; chaining continuation',
          jobId,
        );
        progress = {
          version: 1,
          crawl,
          citationPartial: {
            platforms: aiCitations.platforms,
            competingBrandDomains: aiCitations.competingBrands,
          },
        };
        await saveAuditJobProgress(jobId, progress, 'checking_citations');
        await releaseAuditJobClaim(jobId);
        return { completed: false };
      }

      const [targetOpr, targetBacklinks, competitorBacklinks] =
        await Promise.all([
          getPageRank(domain),
          getBacklinkSummary(domain, 200),
          compareBacklinks(aiCitations.competingBrands),
        ]);

      const backlinksEnabled = isCommonCrawlBacklinksEnabled();

      const competingBrandsOpr = aiCitations.competingBrandsOpr.map(
        (brand) => ({
          ...brand,
          referring_domains: backlinksEnabled
            ? competitorBacklinks[brand.domain] !== undefined
              ? competitorBacklinks[brand.domain]!
              : null
            : null,
        }),
      );

      progress = {
        version: 1,
        crawl,
        citationBundle: {
          aiCitations,
          competingBrandsOpr,
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
      };

      await saveAuditJobProgress(jobId, progress, 'scoring');

      if (remainingMs(deadlineMs) < AUDIT_SCORING_RESERVE_MS) {
        await releaseAuditJobClaim(jobId);
        return { completed: false };
      }
    }

    const { citationBundle } = progress;
    if (!citationBundle) {
      throw new Error('Audit checkpoint missing citation bundle');
    }

    // --- Phase 3: score + recommend -------------------------------------
    await updateAuditJobStatus(jobId, 'scoring');
    await heartbeatAuditJob(jobId);

    try {
      const result = await scoreAndRecommend({
        domain,
        robotsResult: crawl.robotsTxt,
        llmsTxt: crawl.llmsTxt,
        sitemap: crawl.sitemap,
        pages: crawl.pages,
        aiCitations: citationBundle.aiCitations,
      });

      await saveAuditReport(jobId, job.project_id, domain, result, crawl, {
        domainCitedInAny: citationBundle.aiCitations.domainCitedInAny,
        citedQueries: citationBundle.aiCitations.citedQueries,
        competingBrands: citationBundle.aiCitations.competingBrands,
        competingBrandsOpr: citationBundle.competingBrandsOpr,
        platforms: citationBundle.aiCitations.platforms,
        oprScore: citationBundle.oprScore,
        oprDecimal: citationBundle.oprDecimal,
        referringDomains: citationBundle.referringDomains,
        topReferringDomains: citationBundle.topReferringDomains,
        competitorBacklinks: citationBundle.competitorBacklinks,
      });

      await updateAuditJobStatus(jobId, 'done', {
        progress: null,
        claimed_until: null,
        error_msg: null,
      });
      return { completed: true };
    } catch (scoreError) {
      const attempts = (progress.scoringAttempts ?? 0) + 1;
      progress = { ...progress, scoringAttempts: attempts };
      await saveAuditJobProgress(jobId, progress, 'scoring');

      if (attempts < 3) {
        console.warn(
          '[rankly] ai-audit scoring failed; will retry',
          jobId,
          attempts,
          scoreError instanceof Error ? scoreError.message : scoreError,
        );
        await releaseAuditJobClaim(jobId);
        return { completed: false };
      }

      throw scoreError;
    }
  } catch (error) {
    await updateAuditJobStatus(jobId, 'error', {
      error_msg: error instanceof Error ? error.message : 'Audit job failed',
      claimed_until: null,
    });
    throw error;
  }
}
