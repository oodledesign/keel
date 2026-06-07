import type {
  ClusterDraft,
  ClusterLink,
  ClusterPlan,
  KeywordIntent,
  QualityGateResult,
  SerpCache,
  SpokeDraft,
} from './types';
import {
  intentWeight,
  normalise,
  titleCaseKeyword,
} from './utils';
import { overlapScore } from '~/lib/dataforseo/serp';

function weightedKd(keywords: ClusterDraft['keywords']): number {
  const totalVolume = keywords.reduce((sum, kw) => sum + kw.search_volume, 0);
  if (totalVolume <= 0) {
    const avg =
      keywords.reduce((sum, kw) => sum + kw.keyword_difficulty, 0) /
      Math.max(keywords.length, 1);
    return Number(avg.toFixed(1));
  }

  const weighted =
    keywords.reduce(
      (sum, kw) => sum + kw.keyword_difficulty * kw.search_volume,
      0,
    ) / totalVolume;

  return Number(weighted.toFixed(1));
}

function generateH2s(keyword: string, intent: KeywordIntent): string[] {
  const base = titleCaseKeyword(keyword);
  if (intent === 'commercial' || intent === 'transactional') {
    return [
      `Why ${base} matters`,
      `How to choose the right option`,
      `Pricing and what to expect`,
      `Common questions`,
    ];
  }

  return [
    `What is ${base}?`,
    `Why it matters`,
    `Step-by-step guide`,
    `Tips and best practices`,
    `Frequently asked questions`,
  ];
}

function buildSpokes(cluster: ClusterDraft): SpokeDraft[] {
  const sorted = cluster.keywords
    .slice()
    .sort((a, b) => b.search_volume - a.search_volume);

  const primary = sorted[0];
  if (!primary) return [];

  const spokeCandidates = sorted.slice(1, 8);
  return spokeCandidates.map((keyword, index) => ({
    title: titleCaseKeyword(keyword.keyword),
    target_keyword: keyword.keyword,
    volume: keyword.search_volume,
    h1: titleCaseKeyword(keyword.keyword),
    h2s: generateH2s(keyword.keyword, keyword.intent),
    position: index + 1,
  }));
}

export function buildArchitecture(clusters: ClusterDraft[]): ClusterPlan[] {
  return clusters.map((cluster) => {
    const sorted = cluster.keywords
      .slice()
      .sort((a, b) => b.search_volume - a.search_volume);
    const primary = sorted[0];
    if (!primary) {
      throw new Error('Cluster has no keywords');
    }

    const secondary = sorted.slice(1).map((kw) => kw.keyword);
    const totalVolume = sorted.reduce((sum, kw) => sum + kw.search_volume, 0);
    const spokes = buildSpokes(cluster);

    return {
      id: cluster.id,
      name: primary.keyword,
      role: 'pillar',
      primary_keyword: primary.keyword,
      secondary_keywords: secondary,
      total_volume: totalVolume,
      weighted_kd: weightedKd(sorted),
      priority_score: 0,
      intent: cluster.dominantIntent,
      pillar_h1: titleCaseKeyword(primary.keyword),
      pillar_h2s: generateH2s(primary.keyword, cluster.dominantIntent),
      build_order: 0,
      spokes,
    };
  });
}

export function prioritise(plans: ClusterPlan[]): ClusterPlan[] {
  const volumes = plans.map((plan) => plan.total_volume);
  const kds = plans.map((plan) => plan.weighted_kd);

  const scored = plans.map((plan) => {
    const volumeScore = normalise(plan.total_volume, volumes) * 0.4;
    const kdScore = (1 - normalise(plan.weighted_kd, kds)) * 0.3;
    const intentScore = intentWeight(plan.intent) * 0.3;
    return {
      ...plan,
      priority_score: Number((volumeScore + kdScore + intentScore).toFixed(2)),
    };
  });

  return scored
    .sort((a, b) => b.priority_score - a.priority_score)
    .map((plan, index) => ({ ...plan, build_order: index + 1 }));
}

export function buildLinkMap(plans: ClusterPlan[]): ClusterLink[] {
  const links: ClusterLink[] = [];

  for (const plan of plans) {
    for (const spoke of plan.spokes) {
      links.push({
        from_cluster_id: plan.id,
        to_cluster_id: plan.id,
        link_type: 'pillar_to_spoke',
      });
      links.push({
        from_cluster_id: plan.id,
        to_cluster_id: plan.id,
        link_type: 'spoke_to_pillar',
      });
      void spoke;
    }
  }

  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      links.push({
        from_cluster_id: plans[i]!.id,
        to_cluster_id: plans[j]!.id,
        link_type: 'cross_link',
      });
    }
  }

  return links;
}

function checkCannibalisation(
  plans: ClusterPlan[],
  serpCache: SerpCache,
): QualityGateResult {
  for (let i = 0; i < plans.length; i++) {
    for (let j = i + 1; j < plans.length; j++) {
      const a = plans[i]!;
      const b = plans[j]!;
      const urlsA = serpCache[a.primary_keyword] ?? [];
      const urlsB = serpCache[b.primary_keyword] ?? [];
      const overlap = overlapScore(urlsA, urlsB);
      const ratio =
        urlsA.length > 0 ? overlap / Math.min(urlsA.length, urlsB.length) : 0;

      if (ratio >= 0.4) {
        return {
          gate: 'cannibalisation',
          status: 'fail',
          detail: `Clusters "${a.name}" and "${b.name}" share ${Math.round(ratio * 100)}% SERP overlap`,
        };
      }
    }
  }

  return {
    gate: 'cannibalisation',
    status: 'pass',
    detail: 'No cluster pairs exceed 40% SERP overlap',
  };
}

function checkOrphans(plans: ClusterPlan[]): QualityGateResult {
  const orphan = plans.find((plan) => plan.spokes.length === 0);
  if (orphan) {
    return {
      gate: 'orphan',
      status: 'warn',
      detail: `Cluster "${orphan.name}" has no spokes`,
    };
  }

  return {
    gate: 'orphan',
    status: 'pass',
    detail: 'Every pillar cluster has at least one spoke',
  };
}

function checkCoverage(plans: ClusterPlan[]): QualityGateResult {
  for (const plan of plans) {
    const covered = new Set([
      plan.primary_keyword,
      ...plan.secondary_keywords,
      ...plan.spokes.map((spoke) => spoke.target_keyword),
    ]);
    const totalKeywords = plan.secondary_keywords.length + 1;
    const ratio = covered.size / Math.max(totalKeywords, 1);

    if (ratio < 0.7) {
      return {
        gate: 'coverage',
        status: 'fail',
        detail: `Cluster "${plan.name}" covers only ${Math.round(ratio * 100)}% of keywords`,
      };
    }
  }

  return {
    gate: 'coverage',
    status: 'pass',
    detail: 'Pillar pages cover at least 70% of cluster keywords',
  };
}

function checkAnchorDiversity(plans: ClusterPlan[]): QualityGateResult {
  for (const plan of plans) {
    const anchors = [
      plan.primary_keyword,
      ...plan.spokes.map((spoke) => spoke.target_keyword),
    ];
    const counts = new Map<string, number>();
    for (const anchor of anchors) {
      counts.set(anchor, (counts.get(anchor) ?? 0) + 1);
    }

    const total = anchors.length;
    for (const count of counts.values()) {
      if (total > 0 && count / total > 0.4) {
        return {
          gate: 'anchor_diversity',
          status: 'warn',
          detail: `Cluster "${plan.name}" reuses one anchor for ${Math.round((count / total) * 100)}% of links`,
        };
      }
    }
  }

  return {
    gate: 'anchor_diversity',
    status: 'pass',
    detail: 'Internal link anchors are sufficiently diverse',
  };
}

export function runQualityGates(
  plans: ClusterPlan[],
  serpCache: SerpCache,
): QualityGateResult[] {
  return [
    checkCannibalisation(plans, serpCache),
    checkOrphans(plans),
    checkCoverage(plans),
    checkAnchorDiversity(plans),
  ];
}

export function mergeCannibalisingPlans(
  plans: ClusterPlan[],
  serpCache: SerpCache,
): ClusterPlan[] {
  const merged = [...plans];
  let changed = true;

  while (changed) {
    changed = false;
    outer: for (let i = 0; i < merged.length; i++) {
      for (let j = i + 1; j < merged.length; j++) {
        const a = merged[i]!;
        const b = merged[j]!;
        const overlap = overlapScore(
          serpCache[a.primary_keyword] ?? [],
          serpCache[b.primary_keyword] ?? [],
        );
        const ratio =
          (serpCache[a.primary_keyword]?.length ?? 0) > 0
            ? overlap /
              Math.min(
                serpCache[a.primary_keyword]?.length ?? 1,
                serpCache[b.primary_keyword]?.length ?? 1,
              )
            : 0;

        if (ratio >= 0.4) {
          const combined: ClusterPlan = {
            ...a,
            secondary_keywords: [
              ...new Set([
                ...a.secondary_keywords,
                a.primary_keyword,
                b.primary_keyword,
                ...b.secondary_keywords,
              ]),
            ],
            total_volume: a.total_volume + b.total_volume,
            weighted_kd: Number(((a.weighted_kd + b.weighted_kd) / 2).toFixed(1)),
            spokes: [...a.spokes, ...b.spokes],
          };
          merged.splice(j, 1);
          merged[i] = combined;
          changed = true;
          break outer;
        }
      }
    }
  }

  return prioritise(merged);
}
