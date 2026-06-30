import type { PlatformCitationResult, PromptLayer } from '~/lib/ai-audit/types';

export type BrandVisibilityRow = {
  platform: string;
  label: string;
  promptLayer?: PromptLayer;
  /** Sampled presence rate across prompts (0–100) */
  presenceRatePct?: number;
  sampleRunsPerPrompt?: number;
  promptsChecked?: number;
  topicsVisible: number;
  totalQueries: number;
  visibilityPct: number;
  sentimentPct: number | null;
  domainCited: boolean;
};

export type SiteOverviewSnapshot = {
  projectId: string;
  domain: string;
  countryCode: string;
  domainPower: number;
  authorityRank: number;
  linkTrust: number;
  citationStrength: number;
  spamScore: number;
  referringDomains: number;
  backlinksCount: number;
  pageAuthority: number;
  organicKeywords: number;
  organicTop3: number;
  organicTraffic: number;
  organicValue: number;
  organicKeywordsDelta: number | null;
  organicTrafficDelta: number | null;
  organicValueDelta: number | null;
  paidKeywords: number;
  paidTraffic: number;
  paidValue: number;
  aiOverviewsCount: number;
  brandSignal: number | null;
  brandVisibility: BrandVisibilityRow[];
  fetchedAt: string;
  expiresAt: string;
};

export type SiteOverviewRow = {
  id: string;
  project_id: string;
  domain: string;
  country_code: string;
  domain_power: number | null;
  authority_rank: number | null;
  link_trust: number | null;
  citation_strength: number | null;
  spam_score: number | null;
  referring_domains: number | null;
  backlinks_count: number | null;
  page_authority: number | null;
  organic_keywords: number | null;
  organic_top3: number | null;
  organic_traffic: number | null;
  organic_value: number | null;
  organic_keywords_delta: number | null;
  organic_traffic_delta: number | null;
  organic_value_delta: number | null;
  paid_keywords: number | null;
  paid_traffic: number | null;
  paid_value: number | null;
  ai_overviews_count: number | null;
  brand_signal: number | null;
  brand_visibility: BrandVisibilityRow[] | null;
  fetched_at: string;
  expires_at: string;
};

export const SITE_OVERVIEW_TTL_DAYS = 7;

export type OrganicPaidMetrics = {
  count: number;
  top3: number;
  etv: number;
  value: number;
};

export type DomainRankMetrics = {
  organic: OrganicPaidMetrics;
  paid: OrganicPaidMetrics;
};

export type BacklinkSummaryMetrics = {
  authorityRank: number;
  pageAuthority: number;
  referringDomains: number;
  backlinksCount: number;
  spamScore: number;
};

export type { PlatformCitationResult };
