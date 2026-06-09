export type PagespeedRecommendationPriority = 'high' | 'medium' | 'low';

export type PagespeedRecommendationCategory =
  | 'performance'
  | 'accessibility'
  | 'best-practices'
  | 'seo';

export type PagespeedRecommendation = {
  auditId: string;
  title: string;
  description: string;
  displayValue: string | null;
  savingsMs: number | null;
  priority: PagespeedRecommendationPriority;
  kind: 'opportunity' | 'diagnostic';
  category: PagespeedRecommendationCategory;
  isQuickWin: boolean;
};

export const PAGESPEED_RECOMMENDATION_CATEGORIES: PagespeedRecommendationCategory[] =
  ['performance', 'accessibility', 'best-practices', 'seo'];

export type PagespeedStrategy = 'mobile' | 'desktop';

export type PagespeedRefreshInterval = 'manual' | 'daily' | 'weekly' | 'monthly';

export type PagespeedPageRow = {
  id: string;
  project_id: string;
  url: string;
  label: string | null;
  is_homepage: boolean;
  created_at: string;
  updated_at: string;
};

export type PagespeedResultRow = {
  id: string;
  page_id: string;
  strategy: PagespeedStrategy;
  performance_score: number | null;
  accessibility_score: number | null;
  best_practices_score: number | null;
  seo_score: number | null;
  lcp_ms: number | null;
  fcp_ms: number | null;
  cls: number | null;
  tbt_ms: number | null;
  speed_index_ms: number | null;
  error_msg: string | null;
  fetched_at: string;
};

export type PagespeedCheckJobRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  status: 'pending' | 'running' | 'done' | 'error';
  trigger_source: 'manual' | 'cron';
  tasks_completed: number;
  tasks_total: number;
  error_msg: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
};

export type PagespeedSnapshot = {
  pageId: string;
  url: string;
  label: string | null;
  isHomepage: boolean;
  mobile: PagespeedMetricSet | null;
  desktop: PagespeedMetricSet | null;
};

export type PagespeedHistoryPoint = {
  fetchedAt: string;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  errorMsg: string | null;
};

export type PagespeedPageHistory = {
  pageId: string;
  url: string;
  label: string | null;
  isHomepage: boolean;
  mobile: PagespeedHistoryPoint[];
  desktop: PagespeedHistoryPoint[];
};

export type PagespeedMetricKey =
  | 'performanceScore'
  | 'accessibilityScore'
  | 'bestPracticesScore'
  | 'seoScore';

export const PAGESPEED_METRIC_LABELS: Record<PagespeedMetricKey, string> = {
  performanceScore: 'Performance',
  accessibilityScore: 'Accessibility',
  bestPracticesScore: 'Best practices',
  seoScore: 'SEO',
};

export const DEFAULT_PAGESPEED_HISTORY_LIMIT = 30;

export type PagespeedMetricSet = {
  resultId: string | null;
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
  fetchedAt: string | null;
  errorMsg: string | null;
  recommendations: PagespeedRecommendation[];
};

export type PagespeedSettings = {
  refreshInterval: PagespeedRefreshInterval;
  lastCheckAt: string | null;
  nextCheckAt: string | null;
};

export type ParsedPagespeedResult = {
  performanceScore: number | null;
  accessibilityScore: number | null;
  bestPracticesScore: number | null;
  seoScore: number | null;
  lcpMs: number | null;
  fcpMs: number | null;
  cls: number | null;
  tbtMs: number | null;
  speedIndexMs: number | null;
};

export type ParsedPagespeedResponse = {
  metrics: ParsedPagespeedResult;
  recommendations: PagespeedRecommendation[];
};

export const PAGESPEED_REFRESH_INTERVAL_LABELS: Record<
  PagespeedRefreshInterval,
  string
> = {
  manual: 'Manual only',
  daily: 'Daily',
  weekly: 'Weekly',
  monthly: 'Monthly',
};

export const MAX_PAGESPEED_PAGES_PER_PROJECT = 25;
