import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { scrapeCompetitorPage, scrapeTopCompetitors } from '~/lib/briefs/competitor-scrape';
import {
  countryCodeToLocation,
  fetchSerp,
} from '~/lib/briefs/serp-analysis';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  analysePageForOptimization,
  detectPageKeyword,
} from './claude-analyser';
import {
  getPageOptimizeJob,
  savePageOptimizeReport,
  updatePageOptimizeJobStatus,
} from './db';
import { PAGE_OPTIMIZE_CREDITS_ESTIMATE } from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function runPageOptimizeJob(jobId: string): Promise<void> {
  const db = ranklyAdmin();

  try {
    const job = await getPageOptimizeJob(jobId);
    const locationCode = countryCodeToLocation(job.country);

    await updatePageOptimizeJobStatus(jobId, 'scraping', {
      credits_used: PAGE_OPTIMIZE_CREDITS_ESTIMATE,
    });

    const pageSnapshot = await scrapeCompetitorPage(job.source_url);

    let targetKeyword = job.target_keyword?.trim() || null;
    if (!targetKeyword) {
      await updatePageOptimizeJobStatus(jobId, 'detecting_keyword');
      targetKeyword = await detectPageKeyword(pageSnapshot);
      await db
        .from('page_optimization_jobs')
        .update({
          target_keyword: targetKeyword,
          updated_at: new Date().toISOString(),
        })
        .eq('id', jobId);
    }

    await updatePageOptimizeJobStatus(jobId, 'serp_analysis');
    const serpData = await fetchSerp(targetKeyword, locationCode, job.country);

    await updatePageOptimizeJobStatus(jobId, 'scraping_competitors');
    const top3Urls = serpData.organic
      .slice(0, 3)
      .map((row) => row.url)
      .filter((url) => url !== job.source_url);
    const competitorPages = await scrapeTopCompetitors(top3Urls);

    await updatePageOptimizeJobStatus(jobId, 'analysing');
    const analysis = await analysePageForOptimization({
      sourceUrl: job.source_url,
      targetKeyword,
      page: pageSnapshot,
      serpResults: serpData.organic,
      competitorPages,
    });

    await savePageOptimizeReport(
      jobId,
      job.project_id,
      job.source_url,
      targetKeyword,
      analysis,
      {
        page_snapshot: pageSnapshot,
        serp_snapshot: serpData.organic,
        competitor_data: competitorPages,
      },
    );

    await updatePageOptimizeJobStatus(jobId, 'done');
  } catch (error) {
    await db
      .from('page_optimization_jobs')
      .update({
        status: 'error',
        error_msg:
          error instanceof Error ? error.message : 'Page optimization failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    throw error;
  }
}
