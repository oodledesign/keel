import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_RECIPIENT_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABEL,
  campaignRecipientStatusBadgeClass,
  campaignRecipientStatusLabel,
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
      CAMPAIGN_STATUS_BADGE_CLASS.cancelled,
    );
  });

  it('covers the public label map', () => {
    expect(Object.keys(CAMPAIGN_STATUS_LABEL).sort()).toEqual(
      [...STATUSES].sort(),
    );
  });

  it('labels recipient send states with distinct pills', () => {
    expect(campaignRecipientStatusLabel('pending')).toBe('Pending');
    expect(campaignRecipientStatusLabel('sent')).toBe('Sent');
    expect(campaignRecipientStatusBadgeClass('failed')).toBe(
      CAMPAIGN_RECIPIENT_STATUS_BADGE_CLASS.failed,
    );
    expect(
      new Set(Object.values(CAMPAIGN_RECIPIENT_STATUS_BADGE_CLASS)).size,
    ).toBe(4);
  });
});
