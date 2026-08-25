import { describe, expect, it } from 'vitest';

import {
  assertSafeTriggerRegex,
  findMatchingTrigger,
  matchTriggerKeyword,
} from './match-trigger';
import type { IgTriggerRow } from './types';

function makeTrigger(overrides: Partial<IgTriggerRow> = {}): IgTriggerRow {
  return {
    id: 't1',
    ig_account_id: 'ig1',
    account_id: 'a1',
    name: 'Test',
    keywords: ['price'],
    match_type: 'contains',
    scope: 'all_posts',
    target_media_ids: null,
    public_reply_enabled: true,
    public_reply_mode: 'static',
    public_reply_template: 'Hi!',
    public_reply_ai_tier: 'standard',
    dm_enabled: false,
    dm_mode: 'static',
    dm_template: null,
    dm_ai_tier: 'standard',
    voice_settings_override: null,
    create_deal_on_match: false,
    deal_stage: 'lead',
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

describe('matchTriggerKeyword', () => {
  it('matches contains case-insensitively', () => {
    expect(
      matchTriggerKeyword('What is the PRICE?', ['price'], 'contains'),
    ).toBe(true);
  });

  it('matches exact only', () => {
    expect(matchTriggerKeyword('price', ['price'], 'exact')).toBe(true);
    expect(matchTriggerKeyword('what price', ['price'], 'exact')).toBe(false);
  });
});

describe('assertSafeTriggerRegex', () => {
  it('rejects nested quantifiers', () => {
    expect(() => assertSafeTriggerRegex('(a+)+')).toThrow(/Unsafe/);
  });

  it('accepts simple patterns', () => {
    expect(() => assertSafeTriggerRegex('^price\\?$')).not.toThrow();
  });
});

describe('findMatchingTrigger', () => {
  it('respects specific post scope', () => {
    const trigger = makeTrigger({
      scope: 'specific_posts',
      target_media_ids: ['media-1'],
    });
    expect(
      findMatchingTrigger([trigger], 'tell me the price', 'media-2'),
    ).toBeNull();
    expect(
      findMatchingTrigger([trigger], 'tell me the price', 'media-1'),
    ).toEqual(trigger);
  });
});
