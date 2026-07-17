import type { BriefTemplate, CompetitorPage, SerpOrganicResult } from './types';

export function classifyTemplate(
  serp: SerpOrganicResult[],
  _competitors: CompetitorPage[],
  keyword: string,
  _serpFeatures: string[],
): { template: BriefTemplate; rationale: string } {
  const kw = keyword.toLowerCase();

  if (kw.startsWith('how to') || kw.startsWith('how do')) {
    return { template: 'how-to', rationale: 'Keyword starts with "how to"' };
  }
  if (/\b(best|top \d+|[\d]+ best)\b/.test(kw)) {
    return {
      template: 'best-of',
      rationale: 'Keyword contains "best" or "top N"',
    };
  }
  if (/\bvs\.?\b|versus|compared to|comparison\b/.test(kw)) {
    return { template: 'comparison', rationale: 'Keyword implies comparison' };
  }
  if (/\breview\b/.test(kw)) {
    return { template: 'review', rationale: 'Keyword contains "review"' };
  }

  const titleSignals = serp.slice(0, 10).map((result) => {
    const t = result.title.toLowerCase();
    if (/\d+ (ways|tips|tools|reasons|examples|ideas)/.test(t))
      return 'listicle';
    if (/^how to|^how do/.test(t)) return 'how-to';
    if (/\bvs\b|versus|comparison/.test(t)) return 'comparison';
    if (/\bbest\b/.test(t)) return 'best-of';
    if (/guide|everything you need|complete|ultimate/.test(t))
      return 'ultimate-guide';
    if (/what is|explained|definition/.test(t)) return 'explainer';
    return 'explainer';
  });

  const counts = titleSignals.reduce<Record<string, number>>((acc, type) => {
    acc[type] = (acc[type] ?? 0) + 1;
    return acc;
  }, {});

  const top = Object.entries(counts).sort((a, b) => b[1] - a[1]);

  if (top.length >= 2 && top[0]![1] - top[1]![1] <= 2) {
    return {
      template: 'MIXED',
      rationale: `SERP split: ${top[0]![0]} (${top[0]![1]}) vs ${top[1]![0]} (${top[1]![1]}) — brief uses ${top[0]![0]} structure with ${top[1]![0]} elements`,
    };
  }

  return {
    template: (top[0]?.[0] ?? 'explainer') as BriefTemplate,
    rationale: `${top[0]?.[1] ?? 0}/10 SERP results follow ${top[0]?.[0] ?? 'explainer'} pattern`,
  };
}
