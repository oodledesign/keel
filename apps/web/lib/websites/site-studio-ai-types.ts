import type {
  WebsiteSitemapPage,
  WebsiteWireframePage,
  WebsiteWireframeSection,
} from './planning-types';

export type SitemapProposeMode =
  | 'from-brief'
  | 'add-missing-seo-pages'
  | 'local-service-variants';

export type SitemapProposal = {
  mode: SitemapProposeMode;
  /** Pages the model suggested (full tree for from-brief; additions otherwise). */
  pages: WebsiteSitemapPage[];
  /** Existing page count before apply (for UI diff). */
  currentPageCount: number;
  /** Slugs already present that were filtered out of add modes. */
  skippedExistingSlugs: string[];
  creditsUsed: number;
};

export type WireframePageProposal = {
  page: WebsiteWireframePage;
  creditsUsed: number;
};

export type WireframeSectionProposal = {
  pageId: string;
  section: WebsiteWireframeSection;
  creditsUsed: number;
};
