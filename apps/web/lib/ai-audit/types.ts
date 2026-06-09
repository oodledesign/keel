export type AuditDimension = 'entity' | 'content' | 'eeat' | 'tech';
export type AuditPriority = 'high' | 'medium' | 'low';

export type AuditJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  target_domain: string;
  status: string;
  error_msg: string | null;
  pages_crawled: number | null;
  credits_used: number | null;
  created_at: string;
  updated_at: string;
};

export type JsonLdBlock = {
  type: string;
  raw: Record<string, unknown>;
  hasKnowsAbout: boolean;
  hasSameAs: boolean;
  hasAuthor: boolean;
  hasReviewer: boolean;
  hasContactPoint: boolean;
};

export type PageCrawl = {
  url: string;
  statusCode: number;
  title: string;
  metaDesc: string;
  canonical: string;
  ogTitle: string;
  ogDesc: string;
  ogImage: string;
  twitterCard: string;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  jsonLd: JsonLdBlock[];
  bylinePresent: boolean;
  tableCount: number;
  faqPatternPresent: boolean;
  wordCount: number;
  isJsRendered: boolean;
  lastUpdatedVisible: boolean;
  hasTldr: boolean;
  contactInfoPresent: boolean;
  internalLinkCount: number;
  externalLinkCount: number;
  crawlFailed?: boolean;
  fetchProfile?: 'rankly' | 'browser_fallback';
  botBlockedInitially?: boolean;
};

export type RobotsResult = {
  present: boolean;
  raw: string;
  blocked: string[];
  allowed: string[];
  wildcardBlocked: boolean;
};

export type LlmsTxtResult = {
  present: boolean;
  wordCount?: number;
  raw?: string;
};

export type SitemapResult = {
  present: boolean;
  urlCount: number;
  lastmod?: string | null;
};

export type CrawlResult = {
  robotsTxt: RobotsResult;
  llmsTxt: LlmsTxtResult;
  sitemap: SitemapResult;
  pages: PageCrawl[];
};

export type CitationPlatform =
  | 'google_ai_overview'
  | 'chatgpt'
  | 'perplexity'
  | 'claude';

export type CitationCheck = {
  query: string;
  triggered: boolean;
  domainCited: boolean;
  citedUrls: string[];
};

export type PlatformCitationResult = {
  platform: CitationPlatform;
  label: string;
  domainCitedInAny: boolean;
  citedQueries: string[];
  citations: CitationCheck[];
};

export type CompetingBrandOpr = {
  domain: string;
  opr: number;
  opr_decimal: number;
};

export type AiCitationResult = {
  platforms: PlatformCitationResult[];
  /** @deprecated use platforms — flat list for scorer prompt */
  citations: CitationCheck[];
  domainCitedInAny: boolean;
  citedQueries: string[];
  competingBrands: string[];
  competingBrandsOpr: CompetingBrandOpr[];
};

export type ScorerRecommendation = {
  dimension: AuditDimension;
  priority: AuditPriority;
  is_quick_win: boolean;
  title: string;
  description: string;
  outcome: string;
  why: string;
  magnitude: string;
  example_urls: string[];
};

export type ScorerOutput = {
  score_entity: number;
  score_content: number;
  score_eeat: number;
  score_tech: number;
  overall_score: number;
  executive_summary: string;
  recommendations: ScorerRecommendation[];
};

export type ScorerInput = {
  domain: string;
  robotsResult: RobotsResult;
  llmsTxt: LlmsTxtResult;
  sitemap: SitemapResult;
  pages: PageCrawl[];
  aiCitations: AiCitationResult;
};

export type AuditReportRow = {
  id: string;
  job_id: string;
  project_id: string;
  target_domain: string;
  score_entity: number | null;
  score_content: number | null;
  score_eeat: number | null;
  score_tech: number | null;
  overall_score: number | null;
  ai_cited: boolean | null;
  ai_cited_queries: string[] | null;
  ai_competing_brands: string[] | null;
  ai_competing_brands_opr: CompetingBrandOpr[] | null;
  ai_citations_by_platform: PlatformCitationResult[] | null;
  opr_score: number | null;
  opr_decimal: number | null;
  crawl_data: CrawlResult | null;
  executive_summary: string | null;
  created_at: string;
};

export type AuditRecommendationRow = ScorerRecommendation & {
  id: string;
  report_id: string;
  project_id: string;
  fix_snippet: string | null;
  is_starred: boolean;
  display_order: number | null;
  created_at: string;
};

export type ScoreHistoryRow = {
  id: string;
  project_id: string;
  report_id: string;
  score_entity: number | null;
  score_content: number | null;
  score_eeat: number | null;
  score_tech: number | null;
  overall_score: number | null;
  run_at: string;
};

export const AUDIT_STATUS_LABELS: Record<string, string> = {
  pending: 'Starting audit…',
  crawling: 'Crawling your site…',
  extracting: 'Analysing page signals…',
  checking_citations: 'Checking AI search citations…',
  scoring: 'Generating recommendations…',
  done: 'Audit complete',
  error: 'Something went wrong',
};

export const AUDIT_CREDITS_ESTIMATE = 100;

export const CITATION_PLATFORM_LABELS: Record<CitationPlatform, string> = {
  google_ai_overview: 'Google AI Overview',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
};

/** Google AI Overview (5) + ChatGPT/Perplexity/Claude LLM Responses (3 each) */
export const CITATION_QUERIES_GOOGLE = 5;
export const CITATION_QUERIES_LLM = 3;

export const DIMENSION_LABELS: Record<AuditDimension, string> = {
  entity: 'Entity Analysis',
  content: 'Content Readiness',
  eeat: 'E-E-A-T Signals',
  tech: 'Tech Foundation',
};
