import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { loadLatestAuditForProjectAnyMember } from '~/lib/ai-audit/db';
import { DIMENSION_LABELS } from '~/lib/ai-audit/types';
import { loadPagespeedSnapshots } from '~/lib/pagespeed/db';
import { loadKeywordRankSnapshots } from '~/lib/rank-tracking/db';
import { loadRanklyPageInventory } from '~/lib/rankly-pages/db';
import {
  loadLatestSiteCrawlJob,
  loadSiteCrawlPages,
} from '~/lib/site-crawl/db';
import { loadSiteOverviewForProject } from '~/lib/site-overview/db';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import type {
  SeoReportIssueRow,
  SeoReportKeywordRow,
  SeoReportRecommendation,
  SeoReportScoreCard,
  SeoReportSnapshot,
} from './types';

function avg(values: number[]): number | null {
  if (!values.length) return null;
  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function technicalScoreFromCrawl(input: {
  pageCount: number;
  pagesWithIssues: number;
  criticalCount: number;
}): number | null {
  if (input.pageCount <= 0) return null;
  const cleanRatio =
    (input.pageCount - input.pagesWithIssues) / input.pageCount;
  const base = cleanRatio * 100;
  const penalty = Math.min(40, input.criticalCount * 4);
  return clampScore(base - penalty);
}

function visibilityScoreFromKeywords(input: {
  tracked: number;
  top10: number;
  avgPosition: number | null;
  brandSignal: number | null;
}): number | null {
  if (input.tracked <= 0 && input.brandSignal == null) return null;
  const top10Share =
    input.tracked > 0 ? (input.top10 / input.tracked) * 100 : 0;
  const positionScore =
    input.avgPosition != null
      ? clampScore(100 - (input.avgPosition - 1) * 4)
      : 50;
  const brand = input.brandSignal ?? 50;
  if (input.tracked <= 0) return clampScore(brand);
  return clampScore(top10Share * 0.45 + positionScore * 0.35 + brand * 0.2);
}

function fallbackSummary(domain: string, overall: number | null): string {
  if (overall == null) {
    return `SEO snapshot for ${domain}. Run an AI Search Audit, Site Crawl, and PageSpeed check to unlock fuller pillar scores.`;
  }
  if (overall >= 75) {
    return `${domain} is in strong shape overall (${overall}/100). Focus on the remaining recommendations to lock in gains.`;
  }
  if (overall >= 50) {
    return `${domain} scores ${overall}/100 overall. Priority fixes below will move technical, content, and visibility scores fastest.`;
  }
  return `${domain} scores ${overall}/100 overall. Address high-priority recommendations first to improve crawl health, content readiness, and visibility.`;
}

export async function buildSeoReportSnapshot(params: {
  projectId: string;
  accountId: string;
}): Promise<{
  snapshot: SeoReportSnapshot;
  aiAuditReportId: string | null;
  targetDomain: string;
  title: string;
}> {
  const admin = getSupabaseServerAdminClient();
  const rankly = supabaseCustomSchema(admin, 'rankly');

  const { data: project, error: projectError } = await rankly
    .from('projects')
    .select('id, domain, name, account_id')
    .eq('id', params.projectId)
    .eq('account_id', params.accountId)
    .maybeSingle();

  if (projectError || !project) {
    throw new Error(projectError?.message ?? 'Project not found');
  }

  const targetDomain = String(project.domain ?? 'site');
  const projectName = (project.name as string | null)?.trim() || targetDomain;

  const [
    audit,
    overview,
    pagespeedSnapshots,
    crawlJob,
    pageInventory,
    keywordSnapshots,
  ] = await Promise.all([
    loadLatestAuditForProjectAnyMember(params.projectId),
    loadSiteOverviewForProject(params.projectId),
    loadPagespeedSnapshots(params.projectId),
    loadLatestSiteCrawlJob(params.projectId),
    loadRanklyPageInventory(params.projectId),
    loadKeywordRankSnapshots(params.projectId),
  ]);

  const crawlPages =
    crawlJob?.status === 'done'
      ? await loadSiteCrawlPages(crawlJob.id, 2000)
      : [];

  const homepage = pagespeedSnapshots.find((row) => row.isHomepage);
  const mobileScore = homepage?.mobile?.performanceScore ?? null;
  const desktopScore = homepage?.desktop?.performanceScore ?? null;
  const performanceScores = [mobileScore, desktopScore].filter(
    (value): value is number => value != null,
  );
  const performanceScore = avg(performanceScores);

  const pagesWithIssues = crawlPages.filter(
    (page) => Array.isArray(page.issues) && page.issues.length > 0,
  ).length;
  const issueCounts = new Map<string, number>();
  let criticalCount = 0;
  for (const page of crawlPages) {
    for (const issue of page.issues ?? []) {
      const code = String(issue.code);
      issueCounts.set(code, (issueCounts.get(code) ?? 0) + 1);
      if (
        code === 'non_200_status' ||
        code === 'crawl_failed' ||
        code === 'noindex' ||
        code === 'missing_title'
      ) {
        criticalCount += 1;
      }
    }
  }
  const crawlIssues: SeoReportIssueRow[] = [...issueCounts.entries()]
    .map(([code, count]) => ({ code, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 12);

  const technicalScore = technicalScoreFromCrawl({
    pageCount: crawlPages.length,
    pagesWithIssues,
    criticalCount,
  });

  const ranked = keywordSnapshots.filter((row) => row.position != null);
  const top10 = ranked.filter(
    (row) => row.position != null && row.position <= 10,
  ).length;
  const avgPosition = avg(
    ranked
      .map((row) => row.position)
      .filter((value): value is number => value != null),
  );
  const visibilityScore = visibilityScoreFromKeywords({
    tracked: keywordSnapshots.length,
    top10,
    avgPosition,
    brandSignal: overview?.brandSignal ?? null,
  });

  const authorityAvailable = overview != null;
  const pageScores = pageInventory
    .map((page) => page.scores.overall)
    .filter((value): value is number => value != null);
  const pagesAvailable = pageInventory.length > 0;

  const pillars: SeoReportScoreCard[] = [
    {
      id: 'entity',
      label: DIMENSION_LABELS.entity,
      score: audit?.report.score_entity ?? null,
      available: Boolean(audit),
      hint: audit ? null : 'Run AI Search Audit',
    },
    {
      id: 'content',
      label: DIMENSION_LABELS.content,
      score: audit?.report.score_content ?? null,
      available: Boolean(audit),
      hint: audit ? null : 'Run AI Search Audit',
    },
    {
      id: 'eeat',
      label: DIMENSION_LABELS.eeat,
      score: audit?.report.score_eeat ?? null,
      available: Boolean(audit),
      hint: audit ? null : 'Run AI Search Audit',
    },
    {
      id: 'techFoundation',
      label: DIMENSION_LABELS.tech,
      score: audit?.report.score_tech ?? null,
      available: Boolean(audit),
      hint: audit ? null : 'Run AI Search Audit',
    },
    {
      id: 'performance',
      label: 'Performance',
      score: performanceScore,
      available: performanceScores.length > 0,
      hint:
        performanceScores.length > 0
          ? `Mobile ${mobileScore ?? '—'} · Desktop ${desktopScore ?? '—'}`
          : 'Run PageSpeed',
    },
    {
      id: 'technicalSeo',
      label: 'Technical SEO',
      score: technicalScore,
      available: crawlPages.length > 0,
      hint:
        crawlPages.length > 0
          ? `${crawlPages.length - pagesWithIssues}/${crawlPages.length} clean pages`
          : 'Run Site Crawler',
    },
    {
      id: 'authority',
      label: 'Authority',
      score: overview?.domainPower ?? null,
      available: authorityAvailable,
      hint: authorityAvailable
        ? `${overview!.referringDomains} referring domains`
        : 'Open Site Explorer',
    },
    {
      id: 'visibility',
      label: 'Visibility',
      score: visibilityScore,
      available: keywordSnapshots.length > 0 || overview?.brandSignal != null,
      hint:
        keywordSnapshots.length > 0
          ? `${top10} of ${keywordSnapshots.length} in top 10`
          : 'Track keywords',
    },
  ];

  const availableScores = pillars
    .filter((pillar) => pillar.available && pillar.score != null)
    .map((pillar) => pillar.score as number);
  const overallScore =
    audit?.report.overall_score ?? avg(availableScores) ?? null;

  const recommendations: SeoReportRecommendation[] = (
    audit?.recommendations ?? []
  )
    .slice()
    .sort((a, b) => {
      const priorityRank = { high: 0, medium: 1, low: 2 } as const;
      const pa = priorityRank[a.priority] ?? 3;
      const pb = priorityRank[b.priority] ?? 3;
      if (pa !== pb) return pa - pb;
      return (a.display_order ?? 0) - (b.display_order ?? 0);
    })
    .slice(0, 8)
    .map((rec) => ({
      dimension: rec.dimension,
      priority: rec.priority,
      isQuickWin: Boolean(rec.is_quick_win),
      title: rec.title,
      description: rec.description,
      outcome: rec.outcome?.trim() || null,
    }));

  const keywords: SeoReportKeywordRow[] = keywordSnapshots
    .slice()
    .sort((a, b) => {
      if (a.position == null && b.position == null) return 0;
      if (a.position == null) return 1;
      if (b.position == null) return -1;
      return a.position - b.position;
    })
    .slice(0, 20)
    .map((row) => ({
      keyword: row.keyword,
      device: row.device,
      position: row.position,
      positionChange: row.positionChange,
      aiOverviewPresent: row.aiOverviewPresent,
    }));

  const snapshot: SeoReportSnapshot = {
    version: 1,
    generatedAt: new Date().toISOString(),
    targetDomain,
    title: `SEO Report — ${projectName}`,
    overallScore,
    executiveSummary:
      audit?.report.executive_summary?.trim() ||
      fallbackSummary(targetDomain, overallScore),
    pillars,
    recommendations,
    appendix: {
      crawlIssues,
      keywords,
      pagespeed: {
        mobile: mobileScore,
        desktop: desktopScore,
        available: performanceScores.length > 0,
      },
      authority: {
        domainPower: overview?.domainPower ?? null,
        linkTrust: overview?.linkTrust ?? null,
        referringDomains: overview?.referringDomains ?? null,
        brandSignal: overview?.brandSignal ?? null,
        available: authorityAvailable,
      },
      pages: {
        pageCount: pageInventory.length,
        avgOverall: avg(pageScores),
        available: pagesAvailable,
      },
    },
    sources: {
      aiAudit: Boolean(audit),
      siteExplorer: authorityAvailable,
      pagespeed: performanceScores.length > 0,
      siteCrawl: crawlPages.length > 0,
      pages: pagesAvailable,
      keywords: keywordSnapshots.length > 0,
    },
  };

  return {
    snapshot,
    aiAuditReportId: audit?.report.id ?? null,
    targetDomain,
    title: snapshot.title,
  };
}
