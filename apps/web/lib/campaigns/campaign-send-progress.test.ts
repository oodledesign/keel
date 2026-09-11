import { describe, expect, it } from 'vitest';

import {
  buildCampaignSendProgress,
  campaignSendProgressPercent,
  isCampaignSendInFlight,
  isCampaignSendTerminal,
} from './campaign-send-progress';

describe('campaign send progress', () => {
  it('uses stored counters when recipient rows are not ready yet', () => {
    const progress = buildCampaignSendProgress({
      status: 'sending',
      audienceCount: 40,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      lastError: null,
    });

    expect(progress.processedCount).toBe(0);
    expect(progress.remainingCount).toBe(40);
    expect(campaignSendProgressPercent(progress)).toBe(0);
  });

  it('prefers live recipient counts during a batch', () => {
    const progress = buildCampaignSendProgress({
      status: 'sending',
      audienceCount: 40,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      lastError: null,
      recipientCounts: {
        sent: 12,
        failed: 1,
        skipped: 1,
        pending: 26,
      },
    });

    expect(progress.sentCount).toBe(12);
    expect(progress.failedCount).toBe(1);
    expect(progress.skippedCount).toBe(1);
    expect(progress.processedCount).toBe(14);
    expect(progress.remainingCount).toBe(26);
    expect(campaignSendProgressPercent(progress)).toBe(35);
  });

  it('treats a finished send as 100%', () => {
    const progress = buildCampaignSendProgress({
      status: 'sent',
      audienceCount: 10,
      sentCount: 9,
      failedCount: 1,
      skippedCount: 0,
      lastError: null,
      recipientCounts: {
        sent: 9,
        failed: 1,
        skipped: 0,
        pending: 0,
      },
    });

    expect(progress.remainingCount).toBe(0);
    expect(campaignSendProgressPercent(progress)).toBe(100);
  });

  it('stays indeterminate until an audience total exists', () => {
    const progress = buildCampaignSendProgress({
      status: 'draft',
      audienceCount: 0,
      sentCount: 0,
      failedCount: 0,
      skippedCount: 0,
      lastError: null,
    });

    expect(campaignSendProgressPercent(progress)).toBeNull();
  });

  it('classifies in-flight vs terminal statuses', () => {
    expect(isCampaignSendInFlight('sending')).toBe(true);
    expect(isCampaignSendInFlight('draft')).toBe(false);
    expect(isCampaignSendTerminal('sent')).toBe(true);
    expect(isCampaignSendTerminal('failed')).toBe(true);
    expect(isCampaignSendTerminal('sending')).toBe(false);
  });
});
