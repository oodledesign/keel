import type { SeoReportScoreCard, SeoReportSnapshot } from './types';

export type ScoreBand = 'strong' | 'ok' | 'needs_work' | 'critical' | 'unknown';

export function scoreBand(score: number | null | undefined): ScoreBand {
  if (score == null) return 'unknown';
  if (score >= 75) return 'strong';
  if (score >= 50) return 'ok';
  if (score >= 25) return 'needs_work';
  return 'critical';
}

export function scoreBandLabel(band: ScoreBand): string {
  switch (band) {
    case 'strong':
      return 'In good shape';
    case 'ok':
      return 'Room to improve';
    case 'needs_work':
      return 'Needs attention';
    case 'critical':
      return 'Urgent priority';
    default:
      return 'Not measured yet';
  }
}

/** Plain-English meaning for each pillar — written for non-technical clients. */
export const PILLAR_EXPLAINERS: Record<
  string,
  { whatItMeans: string; whyItMatters: string }
> = {
  entity: {
    whatItMeans:
      'How clearly search engines and AI tools can recognise who your business is — your name, services, and presence across the web.',
    whyItMatters:
      'If your brand is unclear online, you are less likely to be recommended in Google, ChatGPT, and similar answers.',
  },
  content: {
    whatItMeans:
      'Whether your pages are written in a way people and AI systems can easily understand and quote — clear structure, useful answers, and enough depth.',
    whyItMatters:
      'Strong content helps you appear for the questions your customers actually ask.',
  },
  eeat: {
    whatItMeans:
      'Signals of Experience, Expertise, Authoritativeness, and Trust — things like author info, contact details, reviews, and evidence you know your subject.',
    whyItMatters:
      'Google and AI tools prefer brands that look credible and trustworthy.',
  },
  techFoundation: {
    whatItMeans:
      'The technical foundations AI and search crawlers need: sitemap, robots rules, structured data, and pages that can be read reliably.',
    whyItMatters:
      'Even great content struggles if machines cannot crawl or understand your site.',
  },
  performance: {
    whatItMeans:
      'How fast your key pages feel on phones and desktops (from Google PageSpeed / Lighthouse).',
    whyItMatters:
      'Slow pages frustrate visitors and can hold back rankings and conversions.',
  },
  technicalSeo: {
    whatItMeans:
      'On-page technical health from a full site crawl — titles, descriptions, headings, canonicals, and similar basics.',
    whyItMatters:
      'Fixing these issues makes every page clearer to Google and easier for customers to find.',
  },
  authority: {
    whatItMeans:
      'How strong your site looks based on links and trust from other websites.',
    whyItMatters:
      'Sites with stronger authority tend to rank more easily and get cited more often.',
  },
  visibility: {
    whatItMeans:
      'How visible you are for the keywords and brand prompts we can measure right now.',
    whyItMatters:
      'This is the closest score to “are customers finding you when they search?”',
  },
};

export const CRAWL_ISSUE_PLAIN: Record<string, string> = {
  missing_title: 'Pages without a clear browser/search title',
  title_too_long: 'Titles that are too long for Google to show fully',
  title_too_short: 'Titles that are too short to explain the page',
  missing_meta_description: 'Pages without a search snippet description',
  meta_too_long: 'Descriptions that are longer than Google usually shows',
  missing_h1: 'Pages missing a main heading',
  multiple_h1: 'Pages with more than one main heading',
  missing_canonical: 'Pages without a preferred URL signal (canonical)',
  noindex: 'Pages blocked from appearing in search',
  non_200_status: 'Pages that return an error or redirect unexpectedly',
  crawl_failed: 'Pages we could not load during the scan',
  duplicate_title: 'Different pages sharing the same title',
  duplicate_meta: 'Different pages sharing the same description',
  malformed_schema: 'Broken structured data markup',
  missing_schema: 'Homepage missing structured data',
  schema_missing_type: 'Structured data missing its type',
  schema_incomplete: 'Incomplete structured data',
};

export function explainScore(score: number | null): string {
  const band = scoreBand(score);
  if (band === 'unknown') {
    return 'This area has not been measured yet for this report.';
  }
  if (band === 'strong') {
    return `Score ${score}/100 — ${scoreBandLabel(band)}. This is a solid position for most businesses.`;
  }
  if (band === 'ok') {
    return `Score ${score}/100 — ${scoreBandLabel(band)}. You are mid-pack; focused work here usually pays off.`;
  }
  if (band === 'needs_work') {
    return `Score ${score}/100 — ${scoreBandLabel(band)}. This is holding the site back and should be on the near-term plan.`;
  }
  return `Score ${score}/100 — ${scoreBandLabel(band)}. This needs priority attention before other SEO work can fully land.`;
}

export function buildClientHeadline(snapshot: SeoReportSnapshot): string {
  const score = snapshot.overallScore;
  const band = scoreBand(score);
  const domain = snapshot.targetDomain;

  if (band === 'unknown') {
    return `Here is where ${domain} stands today — some checks still need to finish for a complete picture.`;
  }
  if (band === 'strong') {
    return `${domain} is in relatively strong shape overall (${score}/100). The sections below show where to protect that lead and where a little extra work will still help.`;
  }
  if (band === 'ok') {
    return `${domain} scores ${score}/100 overall — a workable starting point with clear opportunities. The scores below show what is helping and what is holding the site back.`;
  }
  if (band === 'needs_work') {
    return `${domain} currently scores ${score}/100 overall. That means there is meaningful room to improve how the site shows up in Google and AI answers — the priorities below explain where to start.`;
  }
  return `${domain} currently scores ${score}/100 overall. Several foundations need attention before the site can compete consistently in search and AI recommendations.`;
}

export function buildClientNextSteps(snapshot: SeoReportSnapshot): string[] {
  const steps: string[] = [];
  const scored = snapshot.pillars
    .filter((p) => p.available && p.score != null)
    .slice()
    .sort((a, b) => (a.score ?? 100) - (b.score ?? 100));

  for (const pillar of scored.slice(0, 3)) {
    if ((pillar.score ?? 100) >= 75) continue;
    const explainer = PILLAR_EXPLAINERS[pillar.id];
    steps.push(
      `Improve ${pillar.label.toLowerCase()} (currently ${pillar.score}/100)${
        explainer ? ` — ${explainer.whyItMatters}` : ''
      }`,
    );
  }

  if (snapshot.recommendations.length > 0) {
    const top = snapshot.recommendations[0]!;
    steps.push(`Start with: ${top.title}`);
  }

  if (!snapshot.sources.aiAudit) {
    steps.push(
      'Re-run the AI Search Audit so we can add content, trust, and entity recommendations to this report.',
    );
  }

  if (steps.length === 0) {
    steps.push(
      'Keep monitoring PageSpeed and technical health, and expand keyword tracking to sharpen the visibility score.',
    );
  }

  return steps.slice(0, 5);
}

export function enrichPillarForClient(
  pillar: SeoReportScoreCard,
): SeoReportScoreCard & {
  band: ScoreBand;
  bandLabel: string;
  whatItMeans: string;
  whyItMatters: string;
  scoreExplainer: string;
} {
  const explainer = PILLAR_EXPLAINERS[pillar.id] ?? {
    whatItMeans: 'A health score for this area of your online presence.',
    whyItMatters: 'Higher scores usually mean customers can find you more easily.',
  };
  const band = scoreBand(pillar.available ? pillar.score : null);

  return {
    ...pillar,
    band,
    bandLabel: scoreBandLabel(band),
    whatItMeans: explainer.whatItMeans,
    whyItMatters: explainer.whyItMatters,
    scoreExplainer: pillar.available
      ? explainScore(pillar.score)
      : 'Not measured in this report yet — usually because that scan is still running or needs to be re-run.',
  };
}
