import type { PagespeedRecommendationPriority } from './types';

type LighthouseAudit = {
  id?: string;
  title?: string;
  description?: string;
  score?: number | null;
  scoreDisplayMode?: string;
  displayValue?: string;
  numericValue?: number | null;
  details?: {
    type?: string;
    overallSavingsMs?: number;
  };
};

type LighthouseCategory = {
  auditRefs?: Array<{ id: string; weight?: number; group?: string }>;
};

const HIGH_IMPACT_AUDITS = new Set([
  'largest-contentful-paint',
  'total-blocking-time',
  'cumulative-layout-shift',
  'render-blocking-resources',
  'server-response-time',
  'uses-long-cache-ttl',
  'unused-javascript',
  'unused-css-rules',
  'mainthread-work-breakdown',
  'bootup-time',
]);

function auditCategory(
  auditId: string,
  categories: Record<string, LighthouseCategory>,
): 'performance' | 'accessibility' | 'best-practices' | 'seo' {
  for (const key of [
    'performance',
    'accessibility',
    'best-practices',
    'seo',
  ] as const) {
    const refs = categories[key]?.auditRefs ?? [];
    if (refs.some((ref) => ref.id === auditId)) {
      return key;
    }
  }

  return 'performance';
}

function savingsMs(audit: LighthouseAudit): number | null {
  const fromDetails = audit.details?.overallSavingsMs;
  if (fromDetails != null && !Number.isNaN(fromDetails)) {
    return Math.round(fromDetails);
  }

  if (audit.details?.type === 'opportunity' && audit.numericValue != null) {
    return Math.round(audit.numericValue);
  }

  return null;
}

function computePriority(
  auditId: string,
  score: number,
  savings: number | null,
): PagespeedRecommendationPriority {
  if (
    score <= 0.5 ||
    (savings != null && savings >= 1500) ||
    HIGH_IMPACT_AUDITS.has(auditId)
  ) {
    return 'high';
  }

  if (score <= 0.89 || (savings != null && savings >= 400)) {
    return 'medium';
  }

  return 'low';
}

function priorityRank(priority: PagespeedRecommendationPriority): number {
  switch (priority) {
    case 'high':
      return 0;
    case 'medium':
      return 1;
    default:
      return 2;
  }
}

export type ParsedPagespeedRecommendation = {
  auditId: string;
  title: string;
  description: string;
  displayValue: string | null;
  savingsMs: number | null;
  priority: PagespeedRecommendationPriority;
  kind: 'opportunity' | 'diagnostic';
  category: 'performance' | 'accessibility' | 'best-practices' | 'seo';
  isQuickWin: boolean;
};

export function parsePagespeedRecommendations(json: Record<string, unknown>): ParsedPagespeedRecommendation[] {
  const lighthouse = json.lighthouseResult as
    | {
        categories?: Record<string, LighthouseCategory>;
        audits?: Record<string, LighthouseAudit>;
      }
    | undefined;

  const categories = lighthouse?.categories ?? {};
  const audits = lighthouse?.audits ?? {};
  const recommendations: ParsedPagespeedRecommendation[] = [];

  for (const [auditId, rawAudit] of Object.entries(audits)) {
    const audit = rawAudit ?? {};
    const score = audit.score;

    if (score == null || score >= 0.99) {
      continue;
    }

    if (audit.scoreDisplayMode === 'notApplicable') {
      continue;
    }

    const title = audit.title?.trim();
    if (!title) continue;

    const savings = savingsMs(audit);
    const priority = computePriority(auditId, score, savings);
    const kind =
      audit.details?.type === 'opportunity' ? 'opportunity' : 'diagnostic';
    const isQuickWin =
      kind === 'opportunity' &&
      savings != null &&
      savings >= 200 &&
      score >= 0.5;

    recommendations.push({
      auditId,
      title,
      description: audit.description?.trim() ?? '',
      displayValue: audit.displayValue?.trim() ?? null,
      savingsMs: savings,
      priority,
      kind,
      category: auditCategory(auditId, categories),
      isQuickWin,
    });
  }

  return recommendations.sort((a, b) => {
    const pr = priorityRank(a.priority) - priorityRank(b.priority);
    if (pr !== 0) return pr;
    return (b.savingsMs ?? 0) - (a.savingsMs ?? 0);
  });
}

export const PAGESPEED_CATEGORY_LABELS: Record<
  ParsedPagespeedRecommendation['category'],
  string
> = {
  performance: 'Performance',
  accessibility: 'Accessibility',
  'best-practices': 'Best practices',
  seo: 'SEO',
};

export const PAGESPEED_PRIORITY_LABELS: Record<
  PagespeedRecommendationPriority,
  string
> = {
  high: 'High',
  medium: 'Medium',
  low: 'Low',
};
