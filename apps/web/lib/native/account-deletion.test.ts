import { describe, expect, it } from 'vitest';

import { collectAccountDeletionBlockers } from '@kit/accounts/account-deletion-shared';

import {
  isRecentSignIn,
  lastSignInFromAmr,
  parseNativeAccountDeleteConfirmation,
  toNativeAccountDeletionPreview,
} from './account-deletion-shared';
import { NativeHttpError } from './http';

describe('parseNativeAccountDeleteConfirmation', () => {
  it('accepts DELETE in any case', () => {
    expect(() =>
      parseNativeAccountDeleteConfirmation({ confirm: 'DELETE' }),
    ).not.toThrow();
    expect(() =>
      parseNativeAccountDeleteConfirmation({ confirm: ' delete ' }),
    ).not.toThrow();
  });

  it('rejects anything else', () => {
    for (const body of [null, {}, { confirm: 'yes' }, { confirm: true }]) {
      expect(() => parseNativeAccountDeleteConfirmation(body)).toThrow(
        NativeHttpError,
      );
    }
  });
});

describe('lastSignInFromAmr', () => {
  it('picks the latest timestamp', () => {
    const amr = [
      { method: 'otp', timestamp: 1_700_000_000 },
      { method: 'oauth', timestamp: 1_700_000_600 },
    ];
    expect(lastSignInFromAmr(amr)?.getTime()).toBe(1_700_000_600_000);
  });

  it('returns null for missing or junk claims', () => {
    expect(lastSignInFromAmr(undefined)).toBeNull();
    expect(lastSignInFromAmr([{ method: 'otp' }])).toBeNull();
    expect(lastSignInFromAmr('otp')).toBeNull();
  });
});

describe('isRecentSignIn', () => {
  const now = new Date('2026-10-07T12:00:00Z');

  it('allows sign-ins in the last 10 minutes', () => {
    expect(isRecentSignIn(new Date('2026-10-07T11:55:00Z'), now)).toBe(true);
  });

  it('rejects older, future, or unknown sign-ins', () => {
    expect(isRecentSignIn(new Date('2026-10-07T11:49:00Z'), now)).toBe(false);
    expect(isRecentSignIn(new Date('2026-10-07T12:05:00Z'), now)).toBe(false);
    expect(isRecentSignIn(null, now)).toBe(false);
  });
});

describe('collectAccountDeletionBlockers', () => {
  const clear = {
    isProtected: false,
    isScheduled: false,
    hasChargingSubscription: false,
    ownedTeamWorkspaces: [],
    recentlyAuthenticated: true,
  };

  it('has no blockers for a plain recent account', () => {
    expect(collectAccountDeletionBlockers(clear)).toEqual([]);
  });

  it('blocks shared workspaces but not solo ones', () => {
    expect(
      collectAccountDeletionBlockers({
        ...clear,
        ownedTeamWorkspaces: [{ id: 'a', name: 'Solo', otherMemberCount: 0 }],
      }),
    ).toEqual([]);
    expect(
      collectAccountDeletionBlockers({
        ...clear,
        ownedTeamWorkspaces: [{ id: 'b', name: 'Oodle', otherMemberCount: 2 }],
      }),
    ).toEqual(['owns_shared_workspace']);
  });

  it('reports every blocker', () => {
    expect(
      collectAccountDeletionBlockers({
        isProtected: true,
        isScheduled: true,
        hasChargingSubscription: true,
        ownedTeamWorkspaces: [{ id: 'b', name: 'Oodle', otherMemberCount: 1 }],
        recentlyAuthenticated: false,
      }),
    ).toEqual([
      'protected',
      'already_scheduled',
      'active_subscription',
      'owns_shared_workspace',
      'recent_sign_in_required',
    ]);
  });
});

describe('toNativeAccountDeletionPreview', () => {
  it('names shared workspaces in the blocker message', () => {
    const preview = toNativeAccountDeletionPreview({
      enabled: true,
      blockers: ['owns_shared_workspace'],
      scheduledFor: null,
      ownedTeamWorkspaces: [
        { id: 'a', name: 'Solo', otherMemberCount: 0 },
        { id: 'b', name: 'Oodle', otherMemberCount: 2 },
      ],
    });

    expect(preview.blockers[0]?.message).toContain('Oodle');
    expect(preview.blockers[0]?.message).not.toContain('Solo');
    expect(preview.grace_days).toBe(30);
  });
});
