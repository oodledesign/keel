import type { PagespeedSnapshot } from '~/lib/pagespeed/types';
import type { SiteCrawlPageRow } from '~/lib/site-crawl/types';

export type PageScoreBreakdown = {
  overall: number | null;
  onPage: number | null;
  performance: number | null;
  technical: number | null;
  schema: number | null;
};

export type PageRecommendationCategory =
  | 'on-page'
  | 'performance'
  | 'technical'
  | 'schema';

export type PageRecommendation = {
  id: string;
  category: PageRecommendationCategory;
  priority: 'high' | 'medium' | 'low';
  title: string;
  detail: string;
  source: 'site-crawl' | 'pagespeed';
  action?: string;
};

export type RanklyPageSummary = {
  pageKey: string;
  url: string;
  label: string;
  isHomepage: boolean;
  scores: PageScoreBreakdown;
  recommendationCount: number;
  hasCrawlData: boolean;
  hasPagespeedData: boolean;
  lastUpdatedAt: string | null;
};

export type RanklyPageDetail = RanklyPageSummary & {
  crawl: SiteCrawlPageRow | null;
  pagespeed: PagespeedSnapshot | null;
  pagespeedPageId: string | null;
  recommendations: PageRecommendation[];
};

export const PAGE_SCORE_LABELS: Record<
  keyof Omit<PageScoreBreakdown, 'overall'>,
  string
> = {
  onPage: 'On-page SEO',
  performance: 'Performance',
  technical: 'Technical',
  schema: 'Structured data',
};

export const PAGE_RECOMMENDATION_CATEGORY_LABELS: Record<
  PageRecommendationCategory,
  string
> = {
  'on-page': 'On-page SEO',
  performance: 'Performance',
  technical: 'Technical',
  schema: 'Structured data',
};
