import { describe, expect, it } from 'vitest';

import { findMatchingV2Triggers, v2TriggerMatches } from '../match-trigger';
import { isOptInMessage, isOptOutMessage } from './opt-out-keywords';

type MatchTrigger = Parameters<typeof v2TriggerMatches>[0] & { id: string };

function trigger(overrides: Partial<MatchTrigger>): MatchTrigger {
  return {
    id: 't',
    is_active: true,
    keywords: ['guide'],
    match_type: 'contains',
    target_media_ids: null,
    trigger_type: 'comment_keyword',
    match_mode: 'contains',
    media_scope: 'any_post',
    media_id: null,
    ...overrides,
  };
}

describe('opt-out keywords', () => {
  it('matches whole-message STOP variants case-insensitively', () => {
    expect(isOptOutMessage('STOP')).toBe(true);
    expect(isOptOutMessage('Stop!')).toBe(true);
    expect(isOptOutMessage('unsubscribe')).toBe(true);
    expect(isOptOutMessage('Stop messages')).toBe(true);
  });

  it('ignores STOP inside a longer sentence', () => {
    expect(isOptOutMessage("don't stop")).toBe(false);
    expect(isOptOutMessage('stop by on Friday?')).toBe(false);
    expect(isOptOutMessage('')).toBe(false);
  });

  it('matches START to opt back in', () => {
    expect(isOptInMessage('Start')).toBe(true);
    expect(isOptInMessage('start again please')).toBe(false);
  });
});

describe('v2 trigger matching', () => {
  const comment = (text: string, mediaId = 'm1', type = 'FEED') => ({
    kind: 'comment' as const,
    text,
    mediaId,
    mediaProductType: type,
  });

  it('matches comment keywords on any post', () => {
    expect(v2TriggerMatches(trigger({}), comment('Send me the GUIDE'))).toBe(
      true,
    );
    expect(v2TriggerMatches(trigger({}), comment('nice post'))).toBe(false);
  });

  it('respects a specific post scope', () => {
    const t = trigger({ media_scope: 'specific_post', media_id: 'm2' });
    expect(v2TriggerMatches(t, comment('guide', 'm1'))).toBe(false);
    expect(v2TriggerMatches(t, comment('guide', 'm2'))).toBe(true);
  });

  it('limits reels scope to reels', () => {
    const t = trigger({ media_scope: 'reels' });
    expect(v2TriggerMatches(t, comment('guide', 'm1', 'FEED'))).toBe(false);
    expect(v2TriggerMatches(t, comment('guide', 'm1', 'REELS'))).toBe(true);
  });

  it('matches any comment when match mode is any', () => {
    const t = trigger({ match_mode: 'any', keywords: [] });
    expect(v2TriggerMatches(t, comment('hello'))).toBe(true);
  });

  it('never matches inactive triggers', () => {
    expect(
      v2TriggerMatches(trigger({ is_active: false }), comment('guide')),
    ).toBe(false);
  });

  it('prefers a DM keyword trigger over the first-message welcome', () => {
    const welcome = trigger({ id: 'welcome', trigger_type: 'first_message' });
    const keyword = trigger({ id: 'keyword', trigger_type: 'dm_keyword' });
    const matches = findMatchingV2Triggers([welcome, keyword], {
      kind: 'dm',
      text: 'guide please',
      isFirstMessage: true,
    });
    expect(matches.map((m) => m.id)).toEqual(['keyword', 'welcome']);
  });

  it('only fires the welcome on the first message', () => {
    const welcome = trigger({ trigger_type: 'first_message' });
    expect(
      v2TriggerMatches(welcome, {
        kind: 'dm',
        text: 'hi',
        isFirstMessage: false,
      }),
    ).toBe(false);
  });

  it('matches story replies and mentions by type', () => {
    const reply = trigger({ trigger_type: 'story_reply', keywords: [] });
    expect(
      v2TriggerMatches(reply, {
        kind: 'story_reply',
        text: '🔥',
        storyId: 's1',
      }),
    ).toBe(true);
    const mention = trigger({ trigger_type: 'story_mention' });
    expect(v2TriggerMatches(mention, { kind: 'story_mention' })).toBe(true);
    expect(v2TriggerMatches(mention, comment('guide'))).toBe(false);
  });
});
