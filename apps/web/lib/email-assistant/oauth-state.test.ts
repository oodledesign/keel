import { describe, expect, it } from 'vitest';

import {
  safeReturnPath,
  signGoogleOAuthState,
  verifyGoogleOAuthState,
} from './oauth-state';

describe('google oauth state', () => {
  it('round-trips workspace account id for business connect', () => {
    process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';

    const token = signGoogleOAuthState({
      userId: 'user-1',
      returnPath: '/home/arcanum/email',
      mailboxKind: 'business',
      accountId: 'acct-arcanum',
      exp: Date.now() + 60_000,
    });

    const parsed = verifyGoogleOAuthState(token);
    expect(parsed?.userId).toBe('user-1');
    expect(parsed?.mailboxKind).toBe('business');
    expect(parsed?.accountId).toBe('acct-arcanum');
    expect(safeReturnPath(parsed, '/home/email')).toBe('/home/arcanum/email');
  });

  it('rejects expired state', () => {
    process.env.OAUTH_STATE_SECRET = 'test-oauth-state-secret';

    const token = signGoogleOAuthState({
      userId: 'user-1',
      returnPath: '/home/oodle/email',
      mailboxKind: 'business',
      accountId: 'acct-oodle',
      exp: Date.now() - 1,
    });

    expect(verifyGoogleOAuthState(token)).toBeNull();
  });
});
