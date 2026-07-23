export type AuditDimension = 'entity' | 'content' | 'eeat' | 'tech';
export type AuditPriority = 'high' | 'medium' | 'low';

/** Checkpoint so a job can resume across Vercel worker invocations. */
export type AuditJobProgress = {
  version: 1;
  crawl?: CrawlResult;
  /** In-progress citation platforms when a worker ran out of time. */
  citationPartial?: {
    platforms: PlatformCitationResult[];
    competingBrandDomains: string[];
  };
  citationBundle?: {
    aiCitations: AiCitationResult;
    competingBrandsOpr: CompetingBrandOpr[];
    oprScore: number;
    oprDecimal: number;
    referringDomains: number | null;
    topReferringDomains: ReferringDomainRow[];
    competitorBacklinks: Record<string, number>;
  };
};

export type AuditJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  target_domain: string;
  status: string;
  error_msg: string | null;
  pages_crawled: number | null;
  credits_used: number | null;
  progress: AuditJobProgress | null;
  last_worker_trigger_at: string | null;
  claimed_until: string | null;
  created_at: string;
  updated_at: string;
};

export type AuditRunResult = {
  completed: boolean;
  /** True when another worker holds the active lock. */
  alreadyRunning?: boolean;
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

export type PromptLayer = 'generic' | 'contextual';

export type CitationRunSample = {
  domainCited: boolean;
  triggered: boolean;
  citedUrls: string[];
};

export type CitationCheck = {
  query: string;
  /** Category benchmark vs buyer-context prompts */
  promptLayer?: PromptLayer;
  triggered: boolean;
  domainCited: boolean;
  citedUrls: string[];
  /** Share of sample runs where the domain was cited (0–100) */
  presenceRate?: number;
  sampleCount?: number;
  runs?: CitationRunSample[];
};

export type PlatformCitationResult = {
  platform: CitationPlatform;
  label: string;
  promptLayer?: PromptLayer;
  domainCitedInAny: boolean;
  citedQueries: string[];
  citations: CitationCheck[];
  /** Mean presence rate across prompts on this platform (0–100) */
  averagePresenceRate?: number;
};

export type CompetingBrandOpr = {
  domain: string;
  opr: number;
  opr_decimal: number;
  referring_domains?: number | null;
};

export type ReferringDomainRow = {
  domain: string;
  link_count: number;
};

export type AiCitationResult = {
  platforms: PlatformCitationResult[];
  /** @deprecated use platforms — flat list for scorer prompt */
  citations: CitationCheck[];
  domainCitedInAny: boolean;
  citedQueries: string[];
  competingBrands: string[];
  competingBrandsOpr: CompetingBrandOpr[];
  /** True when the time budget cut the citation pass short. */
  truncated?: boolean;
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
  referring_domains: number | null;
  top_referring_domains: ReferringDomainRow[] | null;
  competitor_backlinks: Record<string, number> | null;
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

export const AUDIT_CREDITS_ESTIMATE = 220;

export const CITATION_PLATFORM_LABELS: Record<CitationPlatform, string> = {
  google_ai_overview: 'Google AI Overview',
  chatgpt: 'ChatGPT',
  perplexity: 'Perplexity',
  claude: 'Claude',
};

/** Google AI Overview (4) + ChatGPT/Perplexity/Claude LLM Responses (2 each) */
export const CITATION_QUERIES_GOOGLE = 4;
export const CITATION_QUERIES_LLM = 2;

/** Sample each prompt multiple times — LLM answers are probabilistic */
export const CITATION_SAMPLE_RUNS = 2;

/** Contextual (buyer-decision) prompts derived from brief + crawl */
export const CITATION_CONTEXTUAL_PROMPTS_GOOGLE = 4;
export const CITATION_CONTEXTUAL_PROMPTS_LLM = 2;

export const PROMPT_LAYER_LABELS: Record<PromptLayer, string> = {
  generic: 'Category benchmark',
  contextual: 'Buyer context',
};

export const DIMENSION_LABELS: Record<AuditDimension, string> = {
  entity: 'Entity Analysis',
  content: 'Content Readiness',
  eeat: 'E-E-A-T Signals',
  tech: 'Tech Foundation',
};
