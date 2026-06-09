export type CcIndexEntry = {
  url: string;
  timestamp: string;
  status: string;
  mime: string;
  filename?: string;
  offset?: string;
  length?: string;
};

export type BacklinkResult = {
  src_domain: string;
  src_url: string;
  tgt_url: string;
};

export type ReferringDomain = {
  domain: string;
  link_count: number;
  opr_score?: number;
};

export type BacklinkSummary = {
  referring_domains: number;
  total_backlinks: number;
  top_referring_domains: ReferringDomain[];
  sample_backlinks: BacklinkResult[];
};

export type EnrichedCompetitor = {
  domain: string;
  opr: number;
  opr_decimal: number;
  referring_domains: number | null;
};
