/**
 * Client-safe credit costs for Site Studio AI CTAs.
 * Keep in sync with FEATURE_CONFIG in lib/ai/router.ts.
 */
export const SITE_STUDIO_AI_CREDITS = {
  briefExtract: 2,
  briefSuggest: 8,
  sitemapGenerate: 10,
  wireframeGenerate: 8,
  styleSuggest: 4,
  seoGenerate: 8,
  seoAnswerBlocks: 3,
} as const;

export function siteStudioCreditLabel(credits: number) {
  return `~${credits} credits`;
}
