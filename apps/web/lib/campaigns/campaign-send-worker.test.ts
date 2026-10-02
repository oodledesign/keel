import { describe, expect, it, vi } from 'vitest';

import {
  CAMPAIGN_SEND_DEFAULTS,
  buildCampaignSendContinuationUrl,
  campaignSendWaveSize,
  canCompleteClaim,
  estimateCampaignSendSecondsRemaining,
  isSesThrottleError,
  kickCampaignSendContinuation,
  readCampaignSendSettings,
  recipientClaimIsOpen,
  runWithSendRate,
  shouldContinueCampaignSend,
} from './campaign-send-worker';

describe('campaign send settings', () => {
  it('uses a 10/sec default that finishes 30k in 50 minutes', () => {
    const settings = readCampaignSendSettings({});
    expect(settings).toEqual(CAMPAIGN_SEND_DEFAULTS);
    expect(
      estimateCampaignSendSecondsRemaining(30_000, settings.ratePerSecond),
    ).toBe(3_000);
    expect(campaignSendWaveSize(settings)).toBe(200);
  });

  it('clamps env overrides into a safe range', () => {
    expect(
      readCampaignSendSettings({
        CAMPAIGN_SEND_RATE_PER_SECOND: '0',
        CAMPAIGN_SEND_CONCURRENCY: '99',
        CAMPAIGN_SEND_BUDGET_MS: 'nope',
        CAMPAIGN_SEND_LEASE_SECONDS: '10',
        CAMPAIGN_SEND_THROTTLE_BACKOFF_SECONDS: '1',
      }),
    ).toEqual({
      ratePerSecond: 1,
      concurrency: 20,
      budgetMs: CAMPAIGN_SEND_DEFAULTS.budgetMs,
      leaseSeconds: 30,
      throttleBackoffSeconds: 5,
    });
  });
});

describe('recipient claim leases', () => {
  const now = Date.parse('2026-09-25T12:00:00.000Z');

  it('lets two workers claim disjoint rows and reclaim only after the lease expires', () => {
    const rows = [
      {
        id: 'a',
        status: 'pending',
        claimExpiresAt: null as string | null,
        claimToken: null as string | null,
      },
      { id: 'b', status: 'pending', claimExpiresAt: null, claimToken: null },
      { id: 'c', status: 'pending', claimExpiresAt: null, claimToken: null },
    ];

    const claim = (token: string, limit: number, at: number) => {
      const claimed = [];
      for (const row of rows) {
        if (claimed.length >= limit) break;
        if (!recipientClaimIsOpen(row, at)) continue;
        row.claimToken = token;
        row.claimExpiresAt = new Date(at + 90_000).toISOString();
        claimed.push(row.id);
      }
      return claimed;
    };

    expect(claim('worker-1', 2, now)).toEqual(['a', 'b']);
    expect(claim('worker-2', 2, now)).toEqual(['c']);
    expect(claim('worker-3', 2, now + 1_000)).toEqual([]);
    expect(claim('worker-4', 2, now + 90_000)).toEqual(['a', 'b']);
    expect(canCompleteClaim(rows[0]!, 'worker-1')).toBe(false);
    expect(canCompleteClaim(rows[0]!, 'worker-4')).toBe(true);
    rows[0]!.status = 'sent';
    expect(recipientClaimIsOpen(rows[0]!, now + 200_000)).toBe(false);
  });
});

describe('SES throttle classification', () => {
  it('recognises rate errors and ignores ordinary send failures', () => {
    expect(
      isSesThrottleError(
        Object.assign(new Error('Maximum sending rate exceeded'), {
          name: 'Throttling',
          $metadata: { httpStatusCode: 429 },
        }),
      ),
    ).toBe(true);
    expect(
      isSesThrottleError({
        name: 'TooManyRequestsException',
        message: 'SlowDown',
      }),
    ).toBe(true);
    expect(isSesThrottleError(new Error('Email address is not verified'))).toBe(
      false,
    );
    expect(isSesThrottleError(new Error('Daily message quota exceeded'))).toBe(
      false,
    );
  });
});

describe('campaign send continuation', () => {
  it('chains only after a lock-holding drain that still has pending rows', () => {
    expect(
      shouldContinueCampaignSend({
        remaining: 1200,
        throttled: false,
        lockAcquired: true,
        snapshotIncomplete: false,
      }),
    ).toBe(true);
    expect(
      shouldContinueCampaignSend({
        remaining: 1200,
        throttled: true,
        lockAcquired: true,
        snapshotIncomplete: false,
      }),
    ).toBe(false);
    expect(
      shouldContinueCampaignSend({
        remaining: 1200,
        throttled: false,
        lockAcquired: false,
        snapshotIncomplete: false,
      }),
    ).toBe(false);
    expect(
      shouldContinueCampaignSend({
        remaining: 400,
        throttled: false,
        lockAcquired: true,
        snapshotIncomplete: true,
      }),
    ).toBe(false);
    expect(
      shouldContinueCampaignSend({
        remaining: 0,
        throttled: false,
        lockAcquired: true,
        snapshotIncomplete: false,
      }),
    ).toBe(false);
  });

  it('builds a cron continuation URL and skips the kick when secret or site is missing', () => {
    expect(
      buildCampaignSendContinuationUrl({
        campaignId: 'campaign-1',
        accountId: 'account-1',
        siteUrl: 'https://app.example',
      }),
    ).toBe(
      'https://app.example/api/cron/email-campaigns-send?campaignId=campaign-1&accountId=account-1',
    );

    const fetchImpl = vi.fn(async () => new Response(null, { status: 200 }));
    expect(
      kickCampaignSendContinuation({
        campaignId: 'campaign-1',
        accountId: 'account-1',
        env: {},
        fetchImpl,
      }),
    ).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();

    expect(
      kickCampaignSendContinuation({
        campaignId: 'campaign-1',
        accountId: 'account-1',
        env: {
          CRON_SECRET: 'secret',
          NEXT_PUBLIC_SITE_URL: 'https://app.example',
        },
        fetchImpl,
      }),
    ).toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith(
      'https://app.example/api/cron/email-campaigns-send?campaignId=campaign-1&accountId=account-1',
      {
        method: 'GET',
        headers: { authorization: 'Bearer secret' },
      },
    );
  });
});

describe('runWithSendRate', () => {
  it('spaces starts at the configured rate', async () => {
    let now = 0;
    const starts: number[] = [];

    await runWithSendRate({
      items: ['a', 'b', 'c', 'd'],
      ratePerSecond: 10,
      concurrency: 1,
      now: () => now,
      sleep: async (ms) => {
        now += ms;
      },
      run: async () => {
        starts.push(now);
      },
    });

    expect(starts).toEqual([0, 100, 200, 300]);
  });

  it('never exceeds the concurrency cap', async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const pending = runWithSendRate({
      items: [1, 2, 3, 4],
      ratePerSecond: 1000,
      concurrency: 2,
      run: async () => {
        inFlight += 1;
        maxInFlight = Math.max(maxInFlight, inFlight);
        await gate;
        inFlight -= 1;
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 40));
    expect(maxInFlight).toBe(2);
    expect(inFlight).toBe(2);
    release();
    await pending;
    expect(inFlight).toBe(0);
  });

  it('returns items that were not started after stop', async () => {
    const started: string[] = [];
    const result = await runWithSendRate({
      items: ['a', 'b', 'c'],
      ratePerSecond: 1000,
      concurrency: 1,
      stop: () => started.length >= 1,
      run: async (item) => {
        started.push(item);
      },
    });

    expect(started).toEqual(['a']);
    expect(result.unprocessed).toEqual(['b', 'c']);
  });
});
