import { describe, expect, it } from 'vitest';

import {
  buildNativeMessagePushPayload,
  inferNativeComposeType,
  isAllowedChatImageUrl,
  matchesComposeQuery,
  nativeMessagePushUrl,
  nativeThreadTitle,
  nativeWhoCanSeeLabel,
} from './messages-shared';

describe('inferNativeComposeType', () => {
  it('uses whole-client when a client is selected', () => {
    expect(
      inferNativeComposeType({
        people: [{ id: 'u2', name: 'Alex' }],
        contacts: [],
        client: { id: 'c1', name: 'Hope' },
        job: null,
      }),
    ).toBe('client');
  });

  it('uses job when a project is selected', () => {
    expect(
      inferNativeComposeType({
        people: [],
        contacts: [],
        client: null,
        job: { id: 'j1', title: 'Barn loft' },
      }),
    ).toBe('job');
  });

  it('uses direct for one other person', () => {
    expect(
      inferNativeComposeType({
        people: [{ id: 'u2', name: 'Alex' }],
        contacts: [],
        client: null,
        job: null,
      }),
    ).toBe('direct');
  });

  it('uses group for two or more people', () => {
    expect(
      inferNativeComposeType({
        people: [
          { id: 'u2', name: 'Alex' },
          { id: 'u3', name: 'Sam' },
        ],
        contacts: [],
        client: null,
        job: null,
      }),
    ).toBe('group');
  });
});

describe('nativeWhoCanSeeLabel', () => {
  it('names a direct chat', () => {
    expect(
      nativeWhoCanSeeLabel({
        people: [{ id: 'u2', name: 'Alex' }],
        contacts: [],
        client: null,
        job: null,
      }),
    ).toBe('Only You and Alex can see this.');
  });

  it('explains a whole-client chat', () => {
    expect(
      nativeWhoCanSeeLabel({
        people: [],
        contacts: [],
        client: { id: 'c1', name: 'Hope & Co' },
        job: null,
      }),
    ).toContain('every portal contact for Hope & Co');
  });
});

describe('nativeThreadTitle', () => {
  it('prefers an explicit title', () => {
    expect(
      nativeThreadTitle({
        title: 'Site chat',
        participants: [{ user_id: 'u2', display_name: 'Alex' }],
      }),
    ).toBe('Site chat');
  });

  it('falls back to other participants', () => {
    expect(
      nativeThreadTitle({
        currentUserId: 'me',
        participants: [
          { user_id: 'me', display_name: 'Dan' },
          { user_id: 'u2', display_name: 'Alex' },
        ],
      }),
    ).toBe('Alex');
  });
});

describe('matchesComposeQuery', () => {
  it('matches any field', () => {
    expect(matchesComposeQuery('hope', 'Alex', 'Hope & Co')).toBe(true);
    expect(matchesComposeQuery('zzz', 'Alex')).toBe(false);
    expect(matchesComposeQuery('', 'Alex')).toBe(true);
  });
});

describe('isAllowedChatImageUrl', () => {
  it('accepts public account_image URLs on the Supabase host', () => {
    expect(
      isAllowedChatImageUrl(
        'https://abc.supabase.co/storage/v1/object/public/account_image/acc/chat-1/a.jpg',
        'https://abc.supabase.co',
      ),
    ).toBe(true);
  });

  it('rejects off-host tracking URLs', () => {
    expect(
      isAllowedChatImageUrl(
        'https://evil.example/pixel.png',
        'https://abc.supabase.co',
      ),
    ).toBe(false);
  });
});

describe('nativeMessagePushUrl', () => {
  it('uses the app custom scheme', () => {
    expect(nativeMessagePushUrl('thread-1')).toBe(
      'so.ozer.app://message/thread-1',
    );
    expect(nativeMessagePushUrl('thread-1', 'oodle')).toBe(
      'so.ozer.app://message/thread-1?workspace=oodle',
    );
  });
});

describe('buildNativeMessagePushPayload', () => {
  it('sets the thread deep link', () => {
    expect(
      buildNativeMessagePushPayload({
        threadId: 'thread-1',
        workspace: 'oodle',
        title: 'Alex',
        body: 'On my way',
      }),
    ).toEqual({
      title: 'Alex',
      body: 'On my way',
      threadId: 'thread-1',
      url: 'so.ozer.app://message/thread-1?workspace=oodle',
    });
  });
});
