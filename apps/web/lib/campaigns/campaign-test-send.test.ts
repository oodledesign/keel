import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN,
  campaignTestSubject,
  isUsableMailingListUnsubscribeToken,
  normalizeCampaignTestEmails,
  parseCampaignTestEmailInput,
} from './campaign-test-send';

describe('campaign test send helpers', () => {
  it('normalizes, validates, and dedupes emails', () => {
    expect(
      normalizeCampaignTestEmails([
        ' Ada@Example.com ',
        'ada@example.com',
        'not-an-email',
        '',
        'bob@workspace.test',
      ]),
    ).toEqual(['ada@example.com', 'bob@workspace.test']);
  });

  it('parses free-text lists', () => {
    expect(
      parseCampaignTestEmailInput('ada@example.com, bob@x.test; carol@y.test'),
    ).toEqual(['ada@example.com', 'bob@x.test', 'carol@y.test']);
  });

  it('rejects short and test-preview unsubscribe tokens', () => {
    expect(isUsableMailingListUnsubscribeToken('')).toBe(false);
    expect(isUsableMailingListUnsubscribeToken('short-token')).toBe(false);
    expect(
      isUsableMailingListUnsubscribeToken(CAMPAIGN_TEST_UNSUBSCRIBE_TOKEN),
    ).toBe(false);
    expect(
      isUsableMailingListUnsubscribeToken('a'.repeat(16)),
    ).toBe(true);
  });

  it('prefixes subject with [Test] once', () => {
    expect(campaignTestSubject('Launch day')).toBe('[Test] Launch day');
    expect(campaignTestSubject('[Test] Already')).toBe('[Test] Already');
    expect(campaignTestSubject('[test] lower')).toBe('[test] lower');
    expect(campaignTestSubject('  ')).toBe('[Test] Untitled campaign');
  });
});
