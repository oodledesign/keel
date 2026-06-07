import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import type { PlatformCitationResult } from '~/lib/ai-audit/types';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import {
  countAiOverviewCitations,
  fetchBacklinkSummary,
  fetchDomainRankMetrics,
  locationCodeForProjectCountry,
} from './fetchers';
import {
  buildBrandVisibilityRows,
  computeBrandSignal,
  ranklyMetricsFromBacklinks,
} from './scoring';
import type {
  BrandVisibilityRow,
  SiteOverviewRow,
  SiteOverviewSnapshot,
} from './types';
import { SITE_OVERVIEW_TTL_DAYS } from './types';

function ranklyClient(useAdmin: boolean) {
  const client = useAdmin
    ? getSupabaseServerAdminClient()
    : getSupabaseServerClient();
  return supabaseCustomSchema(client, 'rankly');
}

export function mapSiteOverviewRow(row: SiteOverviewRow): SiteOverviewSnapshot {
  return {
    projectId: row.project_id,
    domain: row.domain,
    countryCode: row.country_code,
    domainPower: row.domain_power ?? 0,
    authorityRank: row.authority_rank ?? 0,
    linkTrust: row.link_trust ?? 0,
    citationStrength: row.citation_strength ?? 0,
    spamScore: row.spam_score ?? 0,
    referringDomains: row.referring_domains ?? 0,
    backlinksCount: row.backlinks_count ?? 0,
    pageAuthority: row.page_authority ?? 0,
    organicKeywords: row.organic_keywords ?? 0,
    organicTop3: row.organic_top3 ?? 0,
    organicTraffic: Number(row.organic_traffic ?? 0),
    organicValue: Number(row.organic_value ?? 0),
    organicKeywordsDelta: row.organic_keywords_delta,
    organicTrafficDelta:
      row.organic_traffic_delta != null
        ? Number(row.organic_traffic_delta)
        : null,
    organicValueDelta:
      row.organic_value_delta != null ? Number(row.organic_value_delta) : null,
    paidKeywords: row.paid_keywords ?? 0,
    paidTraffic: Number(row.paid_traffic ?? 0),
    paidValue: Number(row.paid_value ?? 0),
    aiOverviewsCount: row.ai_overviews_count ?? 0,
    brandSignal: row.brand_signal != null ? Number(row.brand_signal) : null,
    brandVisibility: row.brand_visibility ?? [],
    fetchedAt: row.fetched_at,
    expiresAt: row.expires_at,
  };
}

export async function loadSiteOverviewForProject(
  projectId: string,
): Promise<SiteOverviewSnapshot | null> {
  const { data, error } = await ranklyClient(false)
    .from('site_overviews')
    .select('*')
    .eq('project_id', projectId)
    .maybeSingle();

  if (error || !data) {
    if (error) {
      console.error('[site-overview] load', error.message);
    }
    return null;
  }

  return mapSiteOverviewRow(data as SiteOverviewRow);
}

export function isSiteOverviewStale(
  overview: SiteOverviewSnapshot | null,
): boolean {
  if (!overview) return true;
  return new Date(overview.expiresAt).getTime() <= Date.now();
}

async function loadLatestAuditBrandData(projectId: string): Promise<{
  platforms: PlatformCitationResult[];
  overallScore: number | null;
}> {
  const db = ranklyClient(true);

  const { data: report } = await db
    .from('ai_audit_reports')
    .select('overall_score, ai_citations_by_platform')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!report) {
    return { platforms: [], overallScore: null };
  }

  const platforms = Array.isArray(report.ai_citations_by_platform)
    ? (report.ai_citations_by_platform as PlatformCitationResult[])
    : [];

  return {
    platforms,
    overallScore:
      report.overall_score != null ? Number(report.overall_score) : null,
  };
}

function delta(current: number, previous: number | null | undefined): number | null {
  if (previous == null) return null;
  return current - previous;
}

export async function refreshSiteOverview(input: {
  projectId: string;
  domain: string;
  countryCode: string;
}): Promise<SiteOverviewSnapshot> {
  const locationCode = locationCodeForProjectCountry(input.countryCode);
  const domain = input.domain.trim();

  const existing = await loadSiteOverviewForProject(input.projectId);

  const [rankMetrics, backlinks, aiOverviewsCount, auditBrand] = await Promise.all([
    fetchDomainRankMetrics(domain, locationCode),
    fetchBacklinkSummary(domain),
    countAiOverviewCitations(domain, locationCode),
    loadLatestAuditBrandData(input.projectId),
  ]);

  const ranklyScores = ranklyMetricsFromBacklinks(backlinks);
  const brandVisibility = buildBrandVisibilityRows(
    auditBrand.platforms,
    auditBrand.overallScore,
  );
  const brandSignal = computeBrandSignal({
    domainPower: ranklyScores.domainPower,
    aiOverviewsCount,
    brandVisibility,
    auditOverallScore: auditBrand.overallScore,
  });

  const fetchedAt = new Date();
  const expiresAt = new Date(fetchedAt);
  expiresAt.setDate(expiresAt.getDate() + SITE_OVERVIEW_TTL_DAYS);

  const payload = {
    project_id: input.projectId,
    domain,
    country_code: input.countryCode.toLowerCase(),
    domain_power: ranklyScores.domainPower,
    authority_rank: ranklyScores.authorityRank,
    link_trust: ranklyScores.linkTrust,
    citation_strength: ranklyScores.citationStrength,
    spam_score: backlinks.spamScore,
    referring_domains: backlinks.referringDomains,
    backlinks_count: backlinks.backlinksCount,
    page_authority: backlinks.pageAuthority,
    organic_keywords: rankMetrics.organic.count,
    organic_top3: rankMetrics.organic.top3,
    organic_traffic: rankMetrics.organic.etv,
    organic_value: rankMetrics.organic.value,
    organic_keywords_delta: delta(
      rankMetrics.organic.count,
      existing?.organicKeywords,
    ),
    organic_traffic_delta: delta(rankMetrics.organic.etv, existing?.organicTraffic),
    organic_value_delta: delta(rankMetrics.organic.value, existing?.organicValue),
    paid_keywords: rankMetrics.paid.count,
    paid_traffic: rankMetrics.paid.etv,
    paid_value: rankMetrics.paid.value,
    ai_overviews_count: aiOverviewsCount,
    brand_signal: brandSignal,
    brand_visibility: brandVisibility as BrandVisibilityRow[],
    fetched_at: fetchedAt.toISOString(),
    expires_at: expiresAt.toISOString(),
  };

  const { data, error } = await ranklyClient(true)
    .from('site_overviews')
    .upsert(payload, { onConflict: 'project_id' })
    .select('*')
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? 'Failed to save site overview');
  }

  return mapSiteOverviewRow(data as SiteOverviewRow);
}

export async function assertProjectForOverview(
  client: SupabaseClient,
  projectId: string,
  accountId: string,
): Promise<{ domain: string; target_country: string } | null> {
  const { data, error } = await supabaseCustomSchema(client, 'rankly')
    .from('projects')
    .select('domain, target_country')
    .eq('id', projectId)
    .eq('account_id', accountId)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return {
    domain: String(data.domain),
    target_country: String(data.target_country ?? 'gb'),
  };
}
