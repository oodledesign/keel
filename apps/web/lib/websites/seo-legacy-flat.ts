/** Adapt E1 nested SEO → legacy flat fields for old export/ packs. */
import type { WebsiteSeoPageSeo } from './seo-types';
import { emptyWebsiteSeoPageSeo } from './seo-types';

export type LegacyFlatSeoFields = {
  primaryKeyword: string;
  secondaryKeywords: string;
  title: string;
  metaDescription: string;
  h1: string;
  headingOutline: string;
  internalLinks: string;
  canonicalNotes: string;
  imageAltPlan: string;
  schemaTypes: string[];
  localSeo: string;
  answerBlocks: Array<{ question: string; answer: string }>;
  entityNotes: string;
};

export function toLegacyFlatSeoFields(
  seo: WebsiteSeoPageSeo | null | undefined,
): LegacyFlatSeoFields {
  const value = seo ?? emptyWebsiteSeoPageSeo();
  const h1 =
    value.headingOutline.find((item) => item.level === 1)?.text ??
    value.headingOutline[0]?.text ??
    '';
  return {
    primaryKeyword: value.keywords.primary,
    secondaryKeywords: value.keywords.secondary.join(', '),
    title: value.meta.title,
    metaDescription: value.meta.description,
    h1,
    headingOutline: value.headingOutline
      .map((item) => `H${item.level}: ${item.text}`)
      .join('\n'),
    internalLinks: value.internalLinks
      .map((link) => `/${link.toSlug} — ${link.anchorSuggestion}`)
      .join('\n'),
    canonicalNotes: value.canonicalRule,
    imageAltPlan: value.imageAltPlan
      .map((item) => `${item.imageRole}: ${item.altPattern}`)
      .join('\n'),
    schemaTypes: value.schemaTypes,
    localSeo: [
      value.geo.isLocationPage ? 'Location page' : '',
      value.geo.nap,
      value.geo.serviceArea.join(', '),
    ]
      .filter(Boolean)
      .join('\n'),
    answerBlocks: value.aeo.answerBlocks.map((block) => ({
      question: block.question,
      answer: block.draftAnswer,
    })),
    entityNotes: value.aeo.entityNotes,
  };
}
