export type BriefTemplate =
  | 'ultimate-guide'
  | 'how-to'
  | 'listicle'
  | 'explainer'
  | 'comparison'
  | 'review'
  | 'best-of'
  | 'landing-page'
  | 'MIXED';

export type BriefJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  spoke_id: string | null;
  target_domain: string;
  target_keyword: string | null;
  country: string;
  mode: 'full' | 'quick';
  status: string;
  error_msg: string | null;
  credits_used: number | null;
  topic_reasoning: string | null;
  created_at: string;
  updated_at: string;
};

export type CompetitorWithOpr = {
  domain: string;
  opr: number;
  opr_decimal: number;
};

export type DomainKeyword = {
  keyword: string;
  rank: number;
  volume: number;
  url?: string;
};

export type KeywordGap = {
  keyword: string;
  volume: number;
  kd: number;
  competitor: string;
};

export type SerpOrganicResult = {
  rank: number;
  title: string;
  url: string;
  domain: string;
};

export type SerpData = {
  organic: SerpOrganicResult[];
  features: string[];
};

export type RelatedKeyword = {
  keyword: string;
  volume: number;
  kd?: number;
};

export type AiOverviewData = {
  triggered: boolean;
  citedDomains: string[];
  references: Array<{ url: string; domain: string; title?: string }>;
};

export type CompetitorPage = {
  url: string;
  title: string;
  metaDesc: string;
  ogImage: string;
  twitterCard: string;
  jsonLdTypes: string[];
  bylinePresent: boolean;
  h1s: string[];
  h2s: string[];
  h3s: string[];
  wordCount: number;
  tableCount: number;
  codeBlockCount: number;
  imageCount: number;
  scrapeFailed?: boolean;
};

export type InternalLinkCandidate = {
  keyword: string;
  url: string;
  rank: number;
};

export type OutlineItem = {
  level: 'h2' | 'h3';
  text: string;
  notes: string;
  cite?: string;
};

export type SuggestedLink = {
  from_url: string;
  anchor: string;
  target_section: string;
};

export type BriefSynthesisInput = {
  targetDomain: string;
  targetKeyword: string;
  country: string;
  template: BriefTemplate;
  templateRationale: string;
  domainKeywords: DomainKeyword[];
  competitors: CompetitorWithOpr[];
  keywordGaps: KeywordGap[];
  serpResults: SerpOrganicResult[];
  serpFeatures: string[];
  aiCitedBrands: string[];
  competitorPages: CompetitorPage[];
  relatedKeywords: RelatedKeyword[];
  questionKeywords: string[];
  internalLinkCandidates: InternalLinkCandidate[];
  competitorAvgWc: number;
  primaryVolume: number;
  traffic: { position1_3: number; position5: number };
};

export type BriefOutput = {
  primary_keyword: string;
  secondary_keywords: string[];
  template_type: BriefTemplate;
  template_rationale: string;
  title_options: string[];
  suggested_meta_desc: string;
  h1: string;
  outline: OutlineItem[];
  content_gaps: string[];
  word_count_target: number;
  word_count_min: number;
  word_count_max: number;
  competitor_avg_wc: number;
  suggested_links: SuggestedLink[];
  ai_cited_brands: string[];
  ai_search_actions: string[];
  traffic_position_1_3: number;
  traffic_position_5: number;
  tone_notes: string;
  eeat_notes: string;
  angle: string;
  required_assets: string;
};

export type ContentBriefRow = BriefOutput & {
  id: string;
  job_id: string;
  project_id: string;
  target_keyword: string;
  serp_snapshot: SerpOrganicResult[] | null;
  competitor_data: CompetitorPage[] | null;
  competitor_domains: CompetitorWithOpr[] | null;
  domain_keywords: DomainKeyword[] | null;
  created_at: string;
};

export const BRIEF_STATUS_LABELS: Record<string, string> = {
  pending: 'Starting up…',
  domain_overview: 'Analysing your domain…',
  competitor_discovery: 'Finding competitors…',
  keyword_gap: 'Running keyword gap analysis…',
  serp_analysis: 'Fetching SERP data…',
  scraping_competitors: 'Reading top-ranking pages…',
  classifying: 'Classifying brief template…',
  internal_links: 'Building internal linking plan…',
  synthesising: 'Writing the brief…',
  done: 'Brief ready',
  error: 'Something went wrong',
};

export function estimateBriefCredits(mode: 'full' | 'quick'): number {
  return mode === 'quick' ? 20 : 65;
}
