import { describe, expect, it } from 'vitest';

import {
  campaignTestSubject,
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

  it('prefixes subject with [Test] once', () => {
    expect(campaignTestSubject('Launch day')).toBe('[Test] Launch day');
    expect(campaignTestSubject('[Test] Already')).toBe('[Test] Already');
    expect(campaignTestSubject('[test] lower')).toBe('[test] lower');
    expect(campaignTestSubject('  ')).toBe('[Test] Untitled campaign');
  });
});
