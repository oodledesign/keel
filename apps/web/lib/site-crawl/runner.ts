import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { delay } from '~/lib/clusters/utils';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  getSiteCrawlJob,
  insertSiteCrawlPage,
  loadAllPagesForJob,
  loadCrawledUrlsForJob,
  updateSiteCrawlJob,
  updateSiteCrawlPageIssues,
} from './db';
import { fetchAndParsePage } from './fetch-page';
import { applyDuplicateIssues, summariseIssues } from './issues';
import {
  triggerSiteCrawlRunDebounced,
  RUN_TIME_BUDGET_MS,
} from './trigger-run';
import {
  SITE_CRAWL_JOB_STALE_MINUTES,
  SITE_CRAWL_MAX_ACTIVE_JOBS,
} from './config';
const PAGES_PER_BATCH = 12;
const CRAWL_DELAY_MS = 150;

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

/** Read-only status sync — never triggers workers from poll requests. */
export async function syncSiteCrawlJobProgress(
  jobId: string,
): Promise<'stale_failed' | 'unchanged'> {
  const job = await getSiteCrawlJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return 'unchanged';
  }

  const ageMs = Date.now() - new Date(job.updated_at).getTime();
  const staleMs = SITE_CRAWL_JOB_STALE_MINUTES * 60 * 1000;

  if (
    ageMs > staleMs &&
    job.pending_urls.length > 0 &&
    job.urls_crawled > 0
  ) {
    await updateSiteCrawlJob(jobId, {
      status: 'error',
      error_msg: 'Site crawl timed out. Try again with a lower URL limit.',
      finished_at: new Date().toISOString(),
    });
    return 'stale_failed';
  }

  return 'unchanged';
}

export async function sweepSiteCrawlWorkers(): Promise<{
  scanned: number;
  triggered: number;
}> {
  const { listActiveSiteCrawlJobs } = await import('./db');
  const jobs = await listActiveSiteCrawlJobs(SITE_CRAWL_MAX_ACTIVE_JOBS);

  let triggered = 0;
  for (const job of jobs) {
    const pending = job.pending_urls.length;
    if (pending === 0 && job.urls_crawled >= job.url_limit) {
      continue;
    }

    const didTrigger = await triggerSiteCrawlRunDebounced(job.id);
    if (didTrigger) triggered += 1;
  }

  return { scanned: jobs.length, triggered };
}

async function finalizeSiteCrawlJob(jobId: string): Promise<void> {
  const pages = await loadAllPagesForJob(jobId);
  const withDuplicates = applyDuplicateIssues(pages);

  for (const page of withDuplicates) {
    await updateSiteCrawlPageIssues(page.id, page.issues);
  }

  const refreshed = await loadAllPagesForJob(jobId);
  const issueSummary = summariseIssues(
    refreshed.map((page) => ({ issues: page.issues })),
  );

  await updateSiteCrawlJob(jobId, {
    status: 'done',
    finished_at: new Date().toISOString(),
    pending_urls: [],
    issue_summary: issueSummary,
  });
}

export async function runSiteCrawlJob(
  jobId: string,
  options?: { timeBudgetMs?: number },
): Promise<{ completed: boolean }> {
  const job = await getSiteCrawlJob(jobId);

  if (job.status === 'done' || job.status === 'error') {
    return { completed: true };
  }

  const timeBudgetMs = options?.timeBudgetMs ?? RUN_TIME_BUDGET_MS;
  const startTime = Date.now();

  try {
    await updateSiteCrawlJob(jobId, {
      status: 'running',
      started_at: job.started_at ?? new Date().toISOString(),
    });

    const { data: project, error: projectError } = await ranklyAdmin()
      .from('projects')
      .select('id, domain')
      .eq('id', job.project_id)
      .single();

    if (projectError || !project?.domain) {
      throw new Error('Project not found');
    }

    const domain = String(project.domain);
    const crawled = await loadCrawledUrlsForJob(jobId);
    let pending = [...job.pending_urls];
    let urlsCrawled = job.urls_crawled;
    let processedThisRun = 0;

    while (
      pending.length > 0 &&
      urlsCrawled < job.url_limit &&
      processedThisRun < PAGES_PER_BATCH &&
      Date.now() - startTime < timeBudgetMs
    ) {
      const url = pending.shift();
      if (!url || crawled.has(url)) continue;

      const page = await fetchAndParsePage(url, domain);
      await insertSiteCrawlPage(jobId, job.project_id, page);

      crawled.add(url);
      urlsCrawled += 1;
      processedThisRun += 1;

      if (urlsCrawled < job.url_limit) {
        for (const link of page.internalLinks) {
          if (crawled.has(link) || pending.includes(link)) continue;
          if (crawled.size + pending.length >= job.url_limit) break;
          pending.push(link);
        }
      }

      await updateSiteCrawlJob(jobId, {
        urls_crawled: urlsCrawled,
        urls_discovered: crawled.size + pending.length,
        pending_urls: pending,
      });

      await delay(CRAWL_DELAY_MS);
    }

    const shouldContinue = pending.length > 0 && urlsCrawled < job.url_limit;

    if (shouldContinue) {
      await triggerSiteCrawlRunDebounced(jobId);
      return { completed: false };
    }

    await finalizeSiteCrawlJob(jobId);
    return { completed: true };
  } catch (error) {
    await updateSiteCrawlJob(jobId, {
      status: 'error',
      error_msg: error instanceof Error ? error.message : 'Site crawl failed',
      finished_at: new Date().toISOString(),
    });
    throw error;
  }
}

export async function seedSiteCrawlJob(input: {
  jobId: string;
  domain: string;
  urlLimit: number;
}): Promise<void> {
  const { buildInitialQueue, loadSitemapUrls, projectDomainToStartUrl } =
    await import('./domain');

  const sitemapUrls = await loadSitemapUrls(input.domain, input.urlLimit);
  const pending = buildInitialQueue(input.domain, sitemapUrls).slice(
    0,
    input.urlLimit,
  );

  await updateSiteCrawlJob(input.jobId, {
    start_url: projectDomainToStartUrl(input.domain),
    pending_urls: pending,
    urls_discovered: pending.length,
  });
}
