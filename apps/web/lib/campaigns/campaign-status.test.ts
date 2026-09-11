import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABEL,
  campaignStatusBadgeClass,
  campaignStatusLabel,
} from './campaign-status';
import type { EmailCampaignStatus } from './campaign.types';

const STATUSES: EmailCampaignStatus[] = [
  'draft',
  'scheduled',
  'sending',
  'sent',
  'cancelled',
  'failed',
];

describe('campaign status pills', () => {
  it('labels every known status', () => {
    expect(STATUSES.map(campaignStatusLabel)).toEqual([
      'Draft',
      'Scheduled',
      'Sending',
      'Sent',
      'Cancelled',
      'Failed',
    ]);
  });

  it('uses a distinct colour class per status', () => {
    const classes = STATUSES.map(
      (status) => CAMPAIGN_STATUS_BADGE_CLASS[status],
    );
    expect(new Set(classes).size).toBe(STATUSES.length);
  });

  it('falls back for unknown statuses without throwing', () => {
    expect(campaignStatusLabel('queued_retry')).toBe('Queued Retry');
    expect(campaignStatusBadgeClass('queued_retry')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.draft,
    );
  });

  it('covers the public label map', () => {
    expect(Object.keys(CAMPAIGN_STATUS_LABEL).sort()).toEqual(
      [...STATUSES].sort(),
    );
  });
});
