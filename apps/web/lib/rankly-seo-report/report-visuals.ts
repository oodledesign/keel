import type {
  SeoReportRecommendation,
  SeoReportScoreCard,
  SeoReportSnapshot,
} from './types';

/** Maps AI-audit recommendation dimensions onto report pillar ids. */
const DIMENSION_TO_PILLAR: Record<string, string> = {
  entity: 'entity',
  content: 'content',
  eeat: 'eeat',
  tech: 'techFoundation',
  technical: 'technicalSeo',
  performance: 'performance',
  authority: 'authority',
  visibility: 'visibility',
};

const PRIORITY_BOOST: Record<SeoReportRecommendation['priority'], number[]> = {
  high: [18, 10, 6],
  medium: [10, 6, 3],
  low: [5, 3, 2],
};

export type ScorePotential = {
  current: number | null;
  potential: number | null;
  uplift: number | null;
};

export type PillarPotential = ScorePotential & {
  id: string;
  label: string;
  available: boolean;
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function pillarIdForDimension(dimension: string): string | null {
  const key = dimension.trim().toLowerCase();
  return DIMENSION_TO_PILLAR[key] ?? null;
}

function boostForRecs(recs: SeoReportRecommendation[]): number {
  const byPriority: Record<SeoReportRecommendation['priority'], number> = {
    high: 0,
    medium: 0,
    low: 0,
  };

  let boost = 0;
  for (const rec of recs) {
    const idx = byPriority[rec.priority];
    const steps = PRIORITY_BOOST[rec.priority];
    const step = steps[Math.min(idx, steps.length - 1)] ?? 0;
    byPriority[rec.priority] = idx + 1;
    boost += step;
    if (rec.isQuickWin) boost += 3;
  }
  return boost;
}

/**
 * Estimates a realistic “after recommended fixes” score.
 * Conservative: never invents more than ~35 points of headroom, never above 95.
 */
export function estimatePotentialScore(
  current: number | null | undefined,
  boost: number,
): number | null {
  if (current == null) return null;
  if (boost <= 0) {
    // Mild headroom toward “good” if still below 75 and no mapped recs
    if (current >= 75) return current;
    return clampScore(current + Math.min(8, Math.round((75 - current) * 0.25)));
  }
  const cappedBoost = Math.min(35, boost);
  return clampScore(Math.min(95, current + cappedBoost));
}

export function buildPillarPotentials(
  snapshot: SeoReportSnapshot,
): PillarPotential[] {
  const recsByPillar = new Map<string, SeoReportRecommendation[]>();
  for (const rec of snapshot.recommendations) {
    const pillarId = pillarIdForDimension(rec.dimension);
    if (!pillarId) continue;
    const list = recsByPillar.get(pillarId) ?? [];
    list.push(rec);
    recsByPillar.set(pillarId, list);
  }

  // Tech recs also help on-page technical health
  const techRecs = recsByPillar.get('techFoundation') ?? [];
  if (techRecs.length > 0) {
    const existing = recsByPillar.get('technicalSeo') ?? [];
    recsByPillar.set('technicalSeo', [...existing, ...techRecs]);
  }

  return snapshot.pillars.map((pillar: SeoReportScoreCard) => {
    const boost = boostForRecs(recsByPillar.get(pillar.id) ?? []);
    const current = pillar.available ? pillar.score : null;
    const potential = pillar.available
      ? estimatePotentialScore(current, boost)
      : null;
    const uplift =
      current != null && potential != null
        ? Math.max(0, potential - current)
        : null;

    return {
      id: pillar.id,
      label: pillar.label,
      available: pillar.available,
      current,
      potential,
      uplift,
    };
  });
}

export function buildOverallPotential(
  snapshot: SeoReportSnapshot,
  pillars: PillarPotential[],
): ScorePotential {
  const current = snapshot.overallScore;
  const scored = pillars.filter(
    (p) => p.available && p.current != null && p.potential != null,
  );

  if (current == null) {
    return { current: null, potential: null, uplift: null };
  }

  let potential: number;
  if (scored.length > 0) {
    const avgCurrent =
      scored.reduce((sum, p) => sum + (p.current as number), 0) / scored.length;
    const avgPotential =
      scored.reduce((sum, p) => sum + (p.potential as number), 0) /
      scored.length;
    const delta = avgPotential - avgCurrent;
    // Blend overall with pillar-implied uplift; prefer measured overall as base
    potential = clampScore(
      Math.min(95, current + Math.max(0, Math.round(delta))),
    );
  } else {
    const globalBoost = boostForRecs(snapshot.recommendations);
    potential = estimatePotentialScore(current, globalBoost) ?? current;
  }

  // Ensure potential is never below current
  potential = Math.max(current, potential);

  return {
    current,
    potential,
    uplift: Math.max(0, potential - current),
  };
}

export function scoreTone(score: number | null | undefined): {
  webText: string;
  webBar: string;
  webSoft: string;
  pdf: { r: number; g: number; b: number };
} {
  if (score == null) {
    return {
      webText: 'text-zinc-400',
      webBar: 'bg-zinc-300',
      webSoft: 'bg-zinc-100',
      pdf: { r: 0.7, g: 0.72, b: 0.75 },
    };
  }
  if (score >= 75) {
    return {
      webText: 'text-emerald-700',
      webBar: 'bg-emerald-500',
      webSoft: 'bg-emerald-50',
      pdf: { r: 0.06, g: 0.55, b: 0.4 },
    };
  }
  if (score >= 50) {
    return {
      webText: 'text-amber-700',
      webBar: 'bg-amber-500',
      webSoft: 'bg-amber-50',
      pdf: { r: 0.85, g: 0.55, b: 0.08 },
    };
  }
  if (score >= 25) {
    return {
      webText: 'text-orange-700',
      webBar: 'bg-orange-500',
      webSoft: 'bg-orange-50',
      pdf: { r: 0.9, g: 0.4, b: 0.12 },
    };
  }
  return {
    webText: 'text-rose-700',
    webBar: 'bg-rose-500',
    webSoft: 'bg-rose-50',
    pdf: { r: 0.85, g: 0.22, b: 0.28 },
  };
}

export const PILLAR_ICON_HINT: Record<
  string,
  'building' | 'file' | 'shield' | 'cpu' | 'zap' | 'wrench' | 'link' | 'eye'
> = {
  entity: 'building',
  content: 'file',
  eeat: 'shield',
  techFoundation: 'cpu',
  performance: 'zap',
  technicalSeo: 'wrench',
  authority: 'link',
  visibility: 'eye',
};
