export type KeywordIntent =
  | 'informational'
  | 'commercial'
  | 'transactional'
  | 'navigational';

export type ClusterKeyword = {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number;
  cpc: number;
  intent: KeywordIntent;
};

export type SerpCache = Record<string, string[]>;

export type ClusterDraft = {
  id: string;
  name: string;
  keywords: ClusterKeyword[];
  dominantIntent: KeywordIntent;
};

export type SpokeDraft = {
  title: string;
  target_keyword: string;
  volume: number;
  h1: string;
  h2s: string[];
  position: number;
};

export type ClusterPlan = {
  id: string;
  name: string;
  role: 'pillar' | 'spoke-only';
  primary_keyword: string;
  secondary_keywords: string[];
  total_volume: number;
  weighted_kd: number;
  priority_score: number;
  intent: KeywordIntent;
  pillar_h1: string;
  pillar_h2s: string[];
  build_order: number;
  spokes: SpokeDraft[];
};

export type QualityGateResult = {
  gate: 'cannibalisation' | 'orphan' | 'coverage' | 'anchor_diversity';
  status: 'pass' | 'warn' | 'fail';
  detail: string;
};

export type ClusterLink = {
  from_cluster_id: string;
  to_cluster_id: string;
  link_type: 'pillar_to_spoke' | 'spoke_to_pillar' | 'cross_link';
};

export type ClusterJobRow = {
  id: string;
  project_id: string;
  user_id: string;
  seeds: string[];
  country: string;
  min_volume: number;
  max_kd: number;
  status: string;
  error_msg: string | null;
  credits_used: number | null;
  candidate_count: number | null;
  created_at: string;
  updated_at: string;
};

export type SavedKeywordRow = ClusterKeyword & {
  cluster_id?: string | null;
  cluster_name?: string | null;
  role?: string | null;
};
