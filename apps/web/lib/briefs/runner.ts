import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { synthesiseBrief } from './claude-synthesiser';
import { scrapeTopCompetitors } from './competitor-scrape';
import { getBriefJob, saveBrief, updateBriefJobStatus } from './db';
import {
  enrichCompetitors,
  fetchCompetitors,
  fetchDomainKeywords,
  fetchKeywordGaps,
  pickBestTopic,
} from './domain-analysis';
import { buildInternalLinkCandidates } from './internal-links';
import { loadProjectBriefSettings } from './project-settings';
import {
  countryCodeToLocation,
  fetchAiOverview,
  fetchQuestionKeywords,
  fetchRelatedKeywords,
  fetchSerp,
} from './serp-analysis';
import { classifyTemplate } from './template-classifier';
import { estimateTraffic } from './traffic-potential';
import {
  type CompetitorWithOpr,
  type DomainKeyword,
  type KeywordGap,
  estimateBriefCredits,
} from './types';

function ranklyAdmin() {
  return supabaseCustomSchema(getSupabaseServerAdminClient(), 'rankly');
}

export async function runBriefJob(jobId: string): Promise<void> {
  const db = ranklyAdmin();

  try {
    const job = await getBriefJob(jobId);
    const locationCode = countryCodeToLocation(job.country);

    let domainKeywords: DomainKeyword[] = [];
    let competitorDomains: CompetitorWithOpr[] = [];
    let targetOpr = 0;
    let targetReferringDomains: number | null = null;
    let competitorBacklinks: Record<string, number> = {};
    let keywordGaps: KeywordGap[] = [];
    let targetKeyword = job.target_keyword?.trim() || null;
    let topicReasoning: string | null = null;

    const skipDomainSteps = job.mode === 'quick' || Boolean(job.spoke_id);

    if (!skipDomainSteps && job.mode === 'full') {
      await updateBriefJobStatus(jobId, 'domain_overview');
      domainKeywords = await fetchDomainKeywords(
        job.target_domain,
        locationCode,
      );

      await updateBriefJobStatus(jobId, 'competitor_discovery');
      const rawCompetitors = await fetchCompetitors(
        job.target_domain,
        locationCode,
      );
      const enriched = await enrichCompetitors(
        rawCompetitors,
        job.target_domain,
      );
      competitorDomains = enriched.competitors;
      targetOpr = enriched.targetOpr;
      targetReferringDomains = enriched.targetReferringDomains;
      competitorBacklinks = enriched.competitorBacklinks;

      if (!targetKeyword) {
        await updateBriefJobStatus(jobId, 'keyword_gap');
        keywordGaps = await fetchKeywordGaps(
          job.target_domain,
          rawCompetitors,
          locationCode,
        );
        const picked = pickBestTopic(keywordGaps, domainKeywords);
        targetKeyword = picked.keyword;
        topicReasoning = picked.reasoning;

        await db
          .from('content_brief_jobs')
          .update({
            target_keyword: targetKeyword,
            topic_reasoning: topicReasoning,
          })
          .eq('id', jobId);
      }
    }

    if (!targetKeyword) {
      throw new Error('Target keyword is required for quick mode');
    }

    await updateBriefJobStatus(jobId, 'serp_analysis', {
      credits_used: estimateBriefCredits(job.mode),
    });

    const [serpData, relatedKeywords, questionKeywords, aiOverviewData] =
      await Promise.all([
        fetchSerp(targetKeyword, locationCode, job.country),
        fetchRelatedKeywords(targetKeyword, locationCode),
        fetchQuestionKeywords(targetKeyword, locationCode),
        fetchAiOverview(targetKeyword, locationCode),
      ]);

    await updateBriefJobStatus(jobId, 'scraping_competitors');
    const top3Urls = serpData.organic.slice(0, 3).map((row) => row.url);
    const competitorPages = await scrapeTopCompetitors(top3Urls);

    await updateBriefJobStatus(jobId, 'classifying');
    const { template, rationale } = classifyTemplate(
      serpData.organic,
      competitorPages,
      targetKeyword,
      serpData.features,
    );

    await updateBriefJobStatus(jobId, 'internal_links');
    const internalLinkCandidates = buildInternalLinkCandidates(
      domainKeywords,
      targetKeyword,
    );

    const successfulPages = competitorPages.filter(
      (page) => !page.scrapeFailed,
    );
    const competitorAvgWc = Math.round(
      successfulPages.reduce((sum, page) => sum + page.wordCount, 0) /
        (successfulPages.length || 1),
    );

    const primaryVolume =
      relatedKeywords.find(
        (row) => row.keyword.toLowerCase() === targetKeyword!.toLowerCase(),
      )?.volume ??
      relatedKeywords[0]?.volume ??
      500;

    const brandSettings = await loadProjectBriefSettings(job.project_id);

    await updateBriefJobStatus(jobId, 'synthesising');
    const briefOutput = await synthesiseBrief({
      targetDomain: job.target_domain,
      targetKeyword,
      country: job.country,
      template,
      templateRationale: rationale,
      brandContext: {
        brandName: brandSettings.brief_brand_name,
        voiceNotes: brandSettings.brief_voice_notes,
        mentionRules: brandSettings.brief_mention_rules,
        researchDepth: brandSettings.brief_research_depth,
      },
      domainKeywords,
      competitors: competitorDomains,
      targetOpr,
      targetReferringDomains,
      keywordGaps,
      serpResults: serpData.organic,
      serpFeatures: serpData.features,
      aiCitedBrands: aiOverviewData.citedDomains,
      competitorPages,
      relatedKeywords,
      questionKeywords,
      internalLinkCandidates,
      competitorAvgWc,
      primaryVolume,
      traffic: estimateTraffic(primaryVolume),
    });

    await saveBrief(jobId, job.project_id, targetKeyword, briefOutput, {
      serp_snapshot: serpData.organic,
      competitor_data: competitorPages,
      competitor_domains: competitorDomains,
      target_referring_domains: targetReferringDomains,
      competitor_backlinks: competitorBacklinks,
      domain_keywords: domainKeywords,
    });

    await updateBriefJobStatus(jobId, 'done');
  } catch (error) {
    await db
      .from('content_brief_jobs')
      .update({
        status: 'error',
        error_msg: error instanceof Error ? error.message : 'Brief job failed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', jobId);
    throw error;
  }
}
