import { describe, expect, it } from 'vitest';

import {
  applyGoogleConnectionScope,
  isBusinessMailboxUnscoped,
} from './google-connection-scope';

describe('isBusinessMailboxUnscoped', () => {
  it('treats business without account as unscoped', () => {
    expect(isBusinessMailboxUnscoped('business', null)).toBe(true);
    expect(isBusinessMailboxUnscoped('business', '  ')).toBe(true);
    expect(isBusinessMailboxUnscoped('business', undefined)).toBe(true);
  });

  it('treats business with account as scoped', () => {
    expect(isBusinessMailboxUnscoped('business', 'acc-1')).toBe(false);
  });

  it('never treats personal as unscoped', () => {
    expect(isBusinessMailboxUnscoped('personal', null)).toBe(false);
  });
});

describe('applyGoogleConnectionScope', () => {
  it('filters business lookups by account_id', () => {
    const calls: Array<[string, string]> = [];
    const query = {
      eq(column: string, value: string) {
        calls.push([column, value]);
        return this;
      },
    };

    applyGoogleConnectionScope(query, {
      userId: 'user-1',
      mailboxKind: 'business',
      accountId: 'acct-oodle',
    });

    expect(calls).toEqual([
      ['user_id', 'user-1'],
      ['mailbox_kind', 'business'],
      ['account_id', 'acct-oodle'],
    ]);
  });

  it('does not add account_id for personal mailboxes', () => {
    const calls: Array<[string, string]> = [];
    const query = {
      eq(column: string, value: string) {
        calls.push([column, value]);
        return this;
      },
    };

    applyGoogleConnectionScope(query, {
      userId: 'user-1',
      mailboxKind: 'personal',
    });

    expect(calls).toEqual([
      ['user_id', 'user-1'],
      ['mailbox_kind', 'personal'],
    ]);
  });
});
