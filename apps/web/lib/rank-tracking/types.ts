export type RankRefreshInterval = 'manual' | 'daily' | 'weekly' | 'monthly';

export type RankCheckJobStatus = 'pending' | 'running' | 'done' | 'error';

export type RankCheckTrigger = 'manual' | 'cron';

export type RankCheckJobRow = {
  id: string;
  project_id: string;
  user_id: string | null;
  status: RankCheckJobStatus;
  trigger_source: RankCheckTrigger;
  keyword_count: number;
  device_count: number;
  tasks_completed: number;
  tasks_total: number;
  api_cost_usd: number;
  estimated_cost_usd: number | null;
  error_msg: string | null;
  started_at: string | null;
  finished_at: string | null;
  created_at: string;
  updated_at: string;
  last_worker_trigger_at: string | null;
};

export type KeywordRankSnapshot = {
  keywordId: string;
  keyword: string;
  searchEngine: string;
  device: string;
  position: number | null;
  previousPosition: number | null;
  positionChange: number | null;
  rankingUrl: string | null;
  aiOverviewPresent: boolean;
  rankDate: string | null;
};

export type RankTrackingSettings = {
  rankRefreshInterval: RankRefreshInterval;
  trackDesktop: boolean;
  trackMobile: boolean;
  targetCountry: string;
  lastRankCheckAt: string | null;
  nextRankCheckAt: string | null;
};

export const RANK_REFRESH_INTERVAL_LABELS: Record<RankRefreshInterval, string> =
  {
    manual: 'Manual only',
    daily: 'Daily',
    weekly: 'Weekly',
    monthly: 'Monthly',
  };

export const INTERVAL_DAYS: Record<RankRefreshInterval, number | null> = {
  manual: null,
  daily: 1,
  weekly: 7,
  monthly: 30,
};

/** Approximate DataForSEO SERP live advanced cost per keyword lookup. */
export const ESTIMATED_SERP_COST_USD = 0.003;

export function estimateRankCheckCostUsd(
  keywordCount: number,
  deviceCount: number,
): number {
  const total = keywordCount * deviceCount * ESTIMATED_SERP_COST_USD;
  return Math.round(total * 1000) / 1000;
}

export function computeNextRankCheckAt(
  interval: RankRefreshInterval,
  from: Date = new Date(),
): Date | null {
  const days = INTERVAL_DAYS[interval];
  if (days == null) return null;
  const next = new Date(from);
  next.setDate(next.getDate() + days);
  return next;
}
