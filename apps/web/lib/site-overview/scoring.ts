import type { PlatformCitationResult, PromptLayer } from '~/lib/ai-audit/types';
import { CITATION_SAMPLE_RUNS } from '~/lib/ai-audit/types';

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
  const genericRows = input.brandVisibility.filter(
    (row) => (row.promptLayer ?? 'generic') === 'generic',
  );
  const visibilityRows = genericRows.length ? genericRows : input.brandVisibility;
  const hasVisibility = visibilityRows.length > 0;
  const citedPlatforms = visibilityRows.filter((row) => row.domainCited).length;
  const totalPlatforms = visibilityRows.length;

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
  options?: { promptLayer?: PromptLayer },
): BrandVisibilityRow[] {
  const filtered = options?.promptLayer
    ? platforms.filter(
        (platform) => (platform.promptLayer ?? 'generic') === options.promptLayer,
      )
    : platforms;

  return filtered.map((platform) => {
    const citations = platform.citations;
    const promptsChecked = citations.length;
    const sampleRunsPerPrompt = citations[0]?.sampleCount ?? CITATION_SAMPLE_RUNS;

    const presenceRatePct =
      platform.averagePresenceRate ??
      (promptsChecked > 0
        ? Math.round(
            citations.reduce(
              (sum, citation) =>
                sum +
                (citation.presenceRate ?? (citation.domainCited ? 100 : 0)),
              0,
            ) / promptsChecked,
          )
        : 0);

    const topicsVisible = platform.citedQueries.length;
    const visibilityPct = presenceRatePct;

    let sentimentPct: number | null = null;
    if (platform.domainCitedInAny) {
      sentimentPct =
        auditOverallScore != null
          ? Math.min(95, Math.max(70, auditOverallScore))
          : 80;
    } else if (promptsChecked > 0) {
      sentimentPct =
        auditOverallScore != null ? Math.max(50, auditOverallScore - 15) : null;
    }

    return {
      platform: platform.platform,
      label: platform.label,
      promptLayer: platform.promptLayer ?? 'generic',
      presenceRatePct,
      sampleRunsPerPrompt,
      promptsChecked,
      topicsVisible,
      totalQueries: promptsChecked,
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
