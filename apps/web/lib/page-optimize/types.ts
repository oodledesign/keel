export type PageOptimizeJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  source_url: string;
  target_keyword: string | null;
  country: string;
  status: string;
  error_msg: string | null;
  credits_used: number | null;
  created_at: string;
  updated_at: string;
};

export type PageOptimizeRecommendation = {
  priority: 'high' | 'medium' | 'low';
  category: 'on-page' | 'content' | 'technical' | 'serp';
  title: string;
  detail: string;
  action?: string;
};

export type PageOptimizeAnalysis = {
  score: number;
  target_keyword: string;
  title_suggestions: string[];
  meta_suggestion: string;
  rewrite_summary: string;
  recommendations: PageOptimizeRecommendation[];
};

export const PAGE_OPTIMIZE_STATUS_LABELS: Record<string, string> = {
  pending: 'Starting…',
  scraping: 'Reading your page…',
  detecting_keyword: 'Detecting target keyword…',
  serp_analysis: 'Analysing SERP…',
  scraping_competitors: 'Reading top-ranking pages…',
  analysing: 'Generating recommendations…',
  done: 'Complete',
  error: 'Failed',
};

export const PAGE_OPTIMIZE_CREDITS_ESTIMATE = 8;
