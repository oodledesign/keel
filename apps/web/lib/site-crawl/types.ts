export type SiteCrawlJobStatus = 'pending' | 'running' | 'done' | 'error';

export type SiteCrawlIssueCode =
  | 'missing_title'
  | 'title_too_long'
  | 'title_too_short'
  | 'missing_meta_description'
  | 'meta_too_long'
  | 'missing_h1'
  | 'multiple_h1'
  | 'missing_canonical'
  | 'noindex'
  | 'non_200_status'
  | 'crawl_failed'
  | 'duplicate_title'
  | 'duplicate_meta'
  | 'malformed_schema'
  | 'missing_schema'
  | 'schema_missing_type'
  | 'schema_incomplete';

export type SiteCrawlIssue = {
  code: SiteCrawlIssueCode;
  message: string;
};

export type SiteCrawlJobRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  status: SiteCrawlJobStatus;
  trigger_source: 'manual' | 'cron';
  start_url: string;
  url_limit: number;
  urls_crawled: number;
  urls_discovered: number;
  pending_urls: string[];
  issue_summary: SiteCrawlIssueSummary;
  error_msg: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  last_worker_trigger_at: string | null;
};

export type SiteCrawlIssueSummary = Partial<Record<SiteCrawlIssueCode, number>>;

export type SiteCrawlPageRow = {
  id: string;
  job_id: string;
  project_id: string;
  url: string;
  final_url: string | null;
  status_code: number;
  title: string;
  meta_description: string;
  h1: string;
  h1_count: number;
  canonical: string;
  word_count: number;
  indexable: boolean;
  internal_links_out: number;
  external_links_out: number;
  issues: SiteCrawlIssue[];
  crawl_error: string | null;
  schema_types: string[];
  schema_objects: Record<string, unknown>[];
  crawled_at: string;
};

export type CrawledPageResult = {
  url: string;
  finalUrl: string;
  statusCode: number;
  title: string;
  metaDescription: string;
  h1: string;
  h1Count: number;
  canonical: string;
  wordCount: number;
  indexable: boolean;
  internalLinksOut: number;
  externalLinksOut: number;
  internalLinks: string[];
  issues: SiteCrawlIssue[];
  crawlError: string | null;
  schemaTypes: string[];
  schemaObjects: Record<string, unknown>[];
  fetchProfile?: 'rankly' | 'browser_fallback';
  botBlockedInitially?: boolean;
};

export const SITE_CRAWL_URL_LIMIT_OPTIONS = [100, 500, 1000, 2000] as const;

export const DEFAULT_SITE_CRAWL_URL_LIMIT = 1000;

export const SITE_CRAWL_ISSUE_LABELS: Record<SiteCrawlIssueCode, string> = {
  missing_title: 'Missing title',
  title_too_long: 'Title too long',
  title_too_short: 'Title too short',
  missing_meta_description: 'Missing meta description',
  meta_too_long: 'Meta description too long',
  missing_h1: 'Missing H1',
  multiple_h1: 'Multiple H1s',
  missing_canonical: 'Missing canonical',
  noindex: 'Noindex',
  non_200_status: 'Non-200 status',
  crawl_failed: 'Crawl failed',
  duplicate_title: 'Duplicate title',
  duplicate_meta: 'Duplicate meta description',
  malformed_schema: 'Malformed JSON-LD',
  missing_schema: 'Missing schema (homepage)',
  schema_missing_type: 'Schema missing @type',
  schema_incomplete: 'Incomplete schema',
};
