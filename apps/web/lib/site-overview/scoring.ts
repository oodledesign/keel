import type { PlatformCitationResult } from '~/lib/ai-audit/types';

import type { BacklinkSummaryMetrics, BrandVisibilityRow } from './types';

export function computeCitationStrength(referringDomains: number): number {
  if (referringDomains <= 0) return 0;
  const score = Math.log10(referringDomains + 1) * 25;
  return Math.min(100, Math.round(score));
}

export function computeLinkTrust(authorityRank: number, spamScore: number): number {
  const penalty = Math.min(authorityRank, spamScore * 0.6);
  return Math.max(0, Math.round(authorityRank - penalty));
}

export function computeDomainPower(input: {
  authorityRank: number;
  linkTrust: number;
  citationStrength: number;
}): number {
  const score =
    input.authorityRank * 0.45 +
    input.linkTrust * 0.35 +
    input.citationStrength * 0.2;
  return Math.min(100, Math.round(score));
}

export function computeBrandSignal(input: {
  domainPower: number;
  aiOverviewsCount: number;
  brandVisibility: BrandVisibilityRow[];
  auditOverallScore: number | null;
}): number | null {
  const hasVisibility = input.brandVisibility.length > 0;
  const citedPlatforms = input.brandVisibility.filter((row) => row.domainCited).length;
  const totalPlatforms = input.brandVisibility.length;

  const citationScore =
    totalPlatforms > 0 ? (citedPlatforms / totalPlatforms) * 100 : 0;
  const aioScore = Math.min(100, (input.aiOverviewsCount / 10) * 100);

  if (!hasVisibility && input.aiOverviewsCount === 0) {
    return Math.round(input.domainPower * 0.4);
  }

  const auditBoost =
    input.auditOverallScore != null ? input.auditOverallScore * 0.15 : 0;

  const signal =
    citationScore * 0.4 +
    (input.domainPower / 100) * 100 * 0.25 +
    aioScore * 0.2 +
    auditBoost;

  return Math.min(100, Math.round(signal * 10) / 10);
}

export function buildBrandVisibilityRows(
  platforms: PlatformCitationResult[],
  auditOverallScore: number | null,
): BrandVisibilityRow[] {
  return platforms.map((platform) => {
    const totalQueries = platform.citations.length;
    const topicsVisible = platform.citedQueries.length;
    const visibilityPct =
      totalQueries > 0 ? Math.round((topicsVisible / totalQueries) * 100) : 0;

    let sentimentPct: number | null = null;
    if (platform.domainCitedInAny) {
      sentimentPct =
        auditOverallScore != null
          ? Math.min(95, Math.max(70, auditOverallScore))
          : 80;
    } else if (totalQueries > 0) {
      sentimentPct = auditOverallScore != null ? Math.max(50, auditOverallScore - 15) : null;
    }

    return {
      platform: platform.platform,
      label: platform.label,
      topicsVisible,
      totalQueries,
      visibilityPct,
      sentimentPct,
      domainCited: platform.domainCitedInAny,
    };
  });
}

export function ranklyMetricsFromBacklinks(
  backlinks: BacklinkSummaryMetrics,
): {
  authorityRank: number;
  linkTrust: number;
  citationStrength: number;
  domainPower: number;
} {
  const citationStrength = computeCitationStrength(backlinks.referringDomains);
  const linkTrust = computeLinkTrust(backlinks.authorityRank, backlinks.spamScore);
  const domainPower = computeDomainPower({
    authorityRank: backlinks.authorityRank,
    linkTrust,
    citationStrength,
  });

  return {
    authorityRank: backlinks.authorityRank,
    linkTrust,
    citationStrength,
    domainPower,
  };
}
