export type SeoReportScoreCard = {
  id: string;
  label: string;
  score: number | null;
  available: boolean;
  hint?: string | null;
};

export type SeoReportRecommendation = {
  dimension: string;
  priority: 'high' | 'medium' | 'low';
  isQuickWin: boolean;
  title: string;
  description: string;
  outcome: string | null;
};

export type SeoReportKeywordRow = {
  keyword: string;
  device: string;
  position: number | null;
  positionChange: number | null;
  aiOverviewPresent: boolean;
};

export type SeoReportIssueRow = {
  code: string;
  /** Plain-language label (optional for older snapshots) */
  label?: string;
  count: number;
};

export type SeoReportSnapshot = {
  version: 1;
  generatedAt: string;
  targetDomain: string;
  title: string;
  overallScore: number | null;
  /** Plain-language headline for non-technical clients */
  clientHeadline?: string | null;
  executiveSummary: string | null;
  /** Concrete next steps written for clients */
  nextSteps?: string[];
  pillars: SeoReportScoreCard[];
  recommendations: SeoReportRecommendation[];
  appendix: {
    crawlIssues: SeoReportIssueRow[];
    keywords: SeoReportKeywordRow[];
    pagespeed: {
      mobile: number | null;
      desktop: number | null;
      available: boolean;
    };
    authority: {
      domainPower: number | null;
      linkTrust: number | null;
      referringDomains: number | null;
      brandSignal: number | null;
      available: boolean;
    };
    pages: {
      pageCount: number;
      avgOverall: number | null;
      available: boolean;
    };
  };
  sources: {
    aiAudit: boolean;
    siteExplorer: boolean;
    pagespeed: boolean;
    siteCrawl: boolean;
    pages: boolean;
    keywords: boolean;
  };
};

export type SeoReportSnapshotRow = {
  id: string;
  project_id: string;
  account_id: string;
  created_by: string | null;
  title: string;
  target_domain: string;
  public_share_enabled: boolean;
  public_share_token: string | null;
  snapshot: SeoReportSnapshot;
  ai_audit_report_id: string | null;
  created_at: string;
  updated_at: string;
};
