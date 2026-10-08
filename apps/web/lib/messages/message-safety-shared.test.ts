import { describe, expect, it } from 'vitest';

import {
  NativeReportMessageBodySchema,
  isDirectThreadWithBlockedUser,
  recipientsAfterBlocks,
} from './message-safety-shared';

const ME = '00000000-0000-4000-8000-000000000001';
const BOB = '00000000-0000-4000-8000-000000000002';
const SUE = '00000000-0000-4000-8000-000000000003';
const THREAD = '00000000-0000-4000-8000-0000000000aa';

describe('isDirectThreadWithBlockedUser', () => {
  const direct = {
    type: 'direct',
    participants: [{ user_id: ME }, { user_id: BOB }],
  };

  it('hides a direct thread with a blocked person', () => {
    expect(isDirectThreadWithBlockedUser(direct, new Set([BOB]), ME)).toBe(
      true,
    );
  });

  it('keeps a direct thread when the other person is not blocked', () => {
    expect(isDirectThreadWithBlockedUser(direct, new Set([SUE]), ME)).toBe(
      false,
    );
  });

  it('keeps group threads even when a member is blocked', () => {
    expect(
      isDirectThreadWithBlockedUser(
        { ...direct, type: 'group' },
        new Set([BOB]),
        ME,
      ),
    ).toBe(false);
  });

  it('keeps direct threads with clients who have no user account', () => {
    expect(
      isDirectThreadWithBlockedUser(
        { type: 'direct', participants: [{ user_id: ME }, { user_id: null }] },
        new Set([BOB]),
        ME,
      ),
    ).toBe(false);
  });
});

describe('recipientsAfterBlocks', () => {
  it('drops user ids and emails of people who blocked the sender', () => {
    expect(
      recipientsAfterBlocks({
        userIds: [BOB, SUE],
        emails: ['Bob@Example.com', 'sue@example.com', 'client@example.com'],
        blockerUserIds: new Set([BOB]),
        emailByUserId: new Map([[BOB, 'bob@example.com']]),
      }),
    ).toEqual({
      userIds: [SUE],
      emails: ['sue@example.com', 'client@example.com'],
    });
  });

  it('is a no-op without blockers', () => {
    const input = {
      userIds: [BOB],
      emails: ['bob@example.com'],
      blockerUserIds: new Set<string>(),
      emailByUserId: new Map<string, string>(),
    };
    expect(recipientsAfterBlocks(input)).toEqual({
      userIds: [BOB],
      emails: ['bob@example.com'],
    });
  });
});

describe('NativeReportMessageBodySchema', () => {
  it('defaults block to false and trims blank details away', () => {
    const parsed = NativeReportMessageBodySchema.parse({
      workspace: 'acme',
      thread_id: THREAD,
      reason: 'spam',
      details: '   ',
    });
    expect(parsed.block).toBe(false);
    expect(parsed.details).toBeUndefined();
  });

  it('rejects unknown reasons', () => {
    expect(
      NativeReportMessageBodySchema.safeParse({
        workspace: 'acme',
        thread_id: THREAD,
        reason: 'boring',
      }).success,
    ).toBe(false);
  });
});
