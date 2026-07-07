import { jsonOk } from '~/lib/rankly/api-response';

/**
 * Cron kill switches (set in Vercel env during outages):
 * - DISABLE_ALL_CRONS=true — pauses every guarded cron route
 * - DISABLE_RANKLY_CRONS=true — rankly rank-check + site-crawl workers and hourly enqueue
 * - DISABLE_PLANNER_REMINDERS_CRON=true
 * - DISABLE_GMAIL_SYNC_CRON=true
 */
export const CRON_KILL_SWITCH = {
  ALL: 'DISABLE_ALL_CRONS',
  RANKLY: 'DISABLE_RANKLY_CRONS',
  PLANNER_REMINDERS: 'DISABLE_PLANNER_REMINDERS_CRON',
  GMAIL_SYNC: 'DISABLE_GMAIL_SYNC_CRON',
} as const;

export function isCronDisabled(flag?: string): boolean {
  if (process.env[CRON_KILL_SWITCH.ALL] === 'true') {
    return true;
  }

  if (!flag) {
    return false;
  }

  return process.env[flag] === 'true';
}

export function cronSkippedResponse(reason: string) {
  return jsonOk({ skipped: true, reason });
}
