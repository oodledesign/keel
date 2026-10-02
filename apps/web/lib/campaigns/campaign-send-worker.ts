/**
 * Pure send-worker controls: rate, lease, throttle classification, and
 * whether a finished invocation should chain another one.
 *
 * Defaults target a shared SES account that is often capped near 14 emails
 * per second. 10/sec leaves headroom. A 30k blast is then about 50 minutes,
 * plus a few seconds between chained invocations.
 */

export const CAMPAIGN_SEND_DEFAULTS = {
  ratePerSecond: 10,
  concurrency: 10,
  budgetMs: 240_000,
  leaseSeconds: 90,
  throttleBackoffSeconds: 15,
} as const;

export type CampaignSendSettings = {
  ratePerSecond: number;
  concurrency: number;
  budgetMs: number;
  leaseSeconds: number;
  throttleBackoffSeconds: number;
};

type EnvSource = Record<string, string | undefined>;

function readBoundedInt(
  raw: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (raw == null || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.floor(parsed)));
}

export function readCampaignSendSettings(
  env: EnvSource = process.env,
): CampaignSendSettings {
  return {
    ratePerSecond: readBoundedInt(
      env.CAMPAIGN_SEND_RATE_PER_SECOND,
      CAMPAIGN_SEND_DEFAULTS.ratePerSecond,
      1,
      50,
    ),
    concurrency: readBoundedInt(
      env.CAMPAIGN_SEND_CONCURRENCY,
      CAMPAIGN_SEND_DEFAULTS.concurrency,
      1,
      20,
    ),
    budgetMs: readBoundedInt(
      env.CAMPAIGN_SEND_BUDGET_MS,
      CAMPAIGN_SEND_DEFAULTS.budgetMs,
      5_000,
      280_000,
    ),
    leaseSeconds: readBoundedInt(
      env.CAMPAIGN_SEND_LEASE_SECONDS,
      CAMPAIGN_SEND_DEFAULTS.leaseSeconds,
      30,
      180,
    ),
    throttleBackoffSeconds: readBoundedInt(
      env.CAMPAIGN_SEND_THROTTLE_BACKOFF_SECONDS,
      CAMPAIGN_SEND_DEFAULTS.throttleBackoffSeconds,
      5,
      120,
    ),
  };
}

/** One claim wave. Large enough to amortise the RPC, short enough for the lease. */
export function campaignSendWaveSize(settings: CampaignSendSettings): number {
  return Math.min(
    500,
    Math.max(settings.concurrency, settings.ratePerSecond * 20),
  );
}

export function estimateCampaignSendSecondsRemaining(
  remaining: number,
  ratePerSecond: number,
): number | null {
  if (remaining <= 0 || ratePerSecond <= 0) return null;
  return Math.ceil(remaining / ratePerSecond);
}

/**
 * Pending rows with no lease, or a lease that has already expired, can be claimed.
 * A future `claimExpiresAt` is either an active worker or a throttle backoff.
 */
export function recipientClaimIsOpen(
  row: { status: string; claimExpiresAt: string | null },
  nowMs: number,
): boolean {
  if (row.status !== 'pending') return false;
  if (row.claimExpiresAt == null) return true;
  const expires = Date.parse(row.claimExpiresAt);
  if (Number.isNaN(expires)) return true;
  return expires <= nowMs;
}

/** A completion write is applied only while this worker still holds the lease. */
export function canCompleteClaim(
  row: { status: string; claimToken: string | null },
  claimToken: string,
): boolean {
  return row.status === 'pending' && row.claimToken === claimToken;
}

export function isSesThrottleError(error: unknown): boolean {
  if (typeof error === 'string') {
    return throttleText(error);
  }
  if (!error || typeof error !== 'object') return false;

  const record = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    $metadata?: { httpStatusCode?: unknown };
  };
  if (record.$metadata?.httpStatusCode === 429) return true;

  return throttleText(
    [record.name, record.code, record.message]
      .filter((part) => typeof part === 'string')
      .join(' '),
  );
}

function throttleText(value: string): boolean {
  return /throttl|too many requests|maximum sending rate|rate exceeded|slowdown/i.test(
    value,
  );
}

export function shouldContinueCampaignSend(input: {
  remaining: number;
  throttled: boolean;
  lockAcquired: boolean;
  snapshotIncomplete: boolean;
}): boolean {
  return (
    input.lockAcquired &&
    !input.throttled &&
    !input.snapshotIncomplete &&
    input.remaining > 0
  );
}

export function campaignSendSiteUrl(
  env: EnvSource = process.env,
): string | null {
  const site = env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '');
  if (site) return site;
  const vercel = env.VERCEL_URL?.replace(/\/$/, '');
  if (!vercel) return null;
  return vercel.startsWith('http') ? vercel : `https://${vercel}`;
}

export function buildCampaignSendContinuationUrl(input: {
  campaignId: string;
  accountId: string;
  siteUrl: string | null;
}): string | null {
  if (!input.siteUrl) return null;
  const url = new URL('/api/cron/email-campaigns-send', input.siteUrl);
  url.searchParams.set('campaignId', input.campaignId);
  url.searchParams.set('accountId', input.accountId);
  return url.toString();
}

/**
 * Start the next drain without waiting for it. Returns false when the
 * environment cannot build an authenticated continuation URL.
 */
export function kickCampaignSendContinuation(input: {
  campaignId: string;
  accountId: string;
  env?: EnvSource;
  fetchImpl?: typeof fetch;
}): boolean {
  const env = input.env ?? process.env;
  const secret = env.CRON_SECRET?.trim();
  const url = buildCampaignSendContinuationUrl({
    campaignId: input.campaignId,
    accountId: input.accountId,
    siteUrl: campaignSendSiteUrl(env),
  });
  if (!secret || !url) return false;

  const fetchImpl = input.fetchImpl ?? fetch;
  void fetchImpl(url, {
    method: 'GET',
    headers: { authorization: `Bearer ${secret}` },
  }).catch((error) => {
    console.error(
      '[campaigns] send continuation failed',
      input.campaignId,
      error,
    );
  });
  return true;
}

/**
 * Run `run` at `ratePerSecond`, with at most `concurrency` calls in flight.
 * Slot reservation happens before any await so workers cannot share a start time.
 * When `stop` flips, items not yet started are returned as `unprocessed`.
 */
export async function runWithSendRate<T>(input: {
  items: readonly T[];
  ratePerSecond: number;
  concurrency: number;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  stop?: () => boolean;
  run: (item: T) => Promise<void>;
}): Promise<{ unprocessed: T[] }> {
  const items = input.items;
  if (items.length === 0 || input.ratePerSecond <= 0) {
    return { unprocessed: [...items] };
  }

  const intervalMs = 1000 / input.ratePerSecond;
  const now = input.now ?? Date.now;
  const sleep =
    input.sleep ??
    ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const workers = Math.max(
    1,
    Math.min(Math.floor(input.concurrency), items.length),
  );
  let cursor = 0;
  let nextAt = now();
  const unprocessed: T[] = [];

  const takeRest = () => {
    while (cursor < items.length) {
      const item = items[cursor];
      cursor += 1;
      if (item !== undefined) unprocessed.push(item);
    }
  };

  const worker = async () => {
    for (;;) {
      if (input.stop?.()) {
        takeRest();
        return;
      }

      const index = cursor;
      if (index >= items.length) return;
      cursor += 1;
      const item = items[index];
      if (item === undefined) return;

      const startAt = Math.max(now(), nextAt);
      nextAt = startAt + intervalMs;
      const wait = startAt - now();
      if (wait > 0) await sleep(wait);

      if (input.stop?.()) {
        unprocessed.push(item);
        takeRest();
        return;
      }

      await input.run(item);
    }
  };

  await Promise.all(Array.from({ length: workers }, () => worker()));
  return { unprocessed };
}
