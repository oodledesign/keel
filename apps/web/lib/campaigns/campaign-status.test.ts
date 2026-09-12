import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_RECIPIENT_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_BADGE_CLASS,
  CAMPAIGN_STATUS_LABEL,
  CAMPAIGN_SUBSCRIBER_STATUS_BADGE_CLASS,
  CAMPAIGN_SUBSCRIBER_STATUS_LABEL,
  campaignRecipientStatusBadgeClass,
  campaignRecipientStatusLabel,
  campaignStatusBadgeClass,
  campaignStatusLabel,
  campaignSubscriberStatusBadgeClass,
  campaignSubscriberStatusLabel,
  parseCampaignSubscriberStatus,
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

  it('labels recurring planner extras', () => {
    expect(campaignStatusLabel('ready')).toBe('Ready');
    expect(campaignStatusLabel('skipped')).toBe('Skipped');
    expect(campaignStatusBadgeClass('ready')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.sent,
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

  it('labels mailing-preference subscriber states', () => {
    expect(campaignSubscriberStatusLabel('subscribed')).toBe('Subscribed');
    expect(campaignSubscriberStatusLabel('unsubscribed')).toBe('Unsubscribed');
    expect(campaignSubscriberStatusLabel('suppressed')).toBe('Suppressed');
    expect(campaignSubscriberStatusLabel('none')).toBe('No preference');
    expect(Object.keys(CAMPAIGN_SUBSCRIBER_STATUS_LABEL).sort()).toEqual([
      'none',
      'subscribed',
      'suppressed',
      'unsubscribed',
    ]);
  });

  it('colours subscriber states with distinct soft pills', () => {
    expect(campaignSubscriberStatusBadgeClass('subscribed')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.sent,
    );
    expect(campaignSubscriberStatusBadgeClass('unsubscribed')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.cancelled,
    );
    expect(campaignSubscriberStatusBadgeClass('suppressed')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.failed,
    );
    expect(campaignSubscriberStatusBadgeClass('none')).toBe(
      CAMPAIGN_STATUS_BADGE_CLASS.draft,
    );
    expect(
      new Set(Object.values(CAMPAIGN_SUBSCRIBER_STATUS_BADGE_CLASS)).size,
    ).toBe(4);
  });

  it('parses preference rows and unknown values to none', () => {
    expect(parseCampaignSubscriberStatus('subscribed')).toBe('subscribed');
    expect(parseCampaignSubscriberStatus('unsubscribed')).toBe('unsubscribed');
    expect(parseCampaignSubscriberStatus('suppressed')).toBe('suppressed');
    expect(parseCampaignSubscriberStatus('paused')).toBe('none');
    expect(parseCampaignSubscriberStatus(null)).toBe('none');
  });
});
