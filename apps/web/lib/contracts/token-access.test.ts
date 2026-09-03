import { describe, expect, it } from 'vitest';

import {
  checkContractTokenAccess,
  isContractTokenAccessible,
} from './token-access';

const NOW = new Date('2026-06-01T12:00:00.000Z');

describe('checkContractTokenAccess', () => {
  it('rejects draft contracts', () => {
    expect(
      checkContractTokenAccess({ status: 'draft' }, NOW),
    ).toEqual({ accessible: false, reason: 'status' });
  });

  it('rejects cancelled contracts', () => {
    expect(
      checkContractTokenAccess({ status: 'cancelled' }, NOW),
    ).toEqual({ accessible: false, reason: 'status' });
  });

  it('rejects an unknown/empty status', () => {
    expect(checkContractTokenAccess({ status: null }, NOW)).toEqual({
      accessible: false,
      reason: 'status',
    });
  });

  it.each(['ready_to_sign', 'sent', 'signed'] as const)(
    'accepts %s with no expiry/revocation set',
    (status) => {
      expect(checkContractTokenAccess({ status }, NOW)).toEqual({
        accessible: true,
        reason: null,
      });
    },
  );

  it('rejects a revoked link even if fully signed', () => {
    expect(
      checkContractTokenAccess(
        {
          status: 'signed',
          public_token_revoked_at: '2026-05-01T00:00:00.000Z',
        },
        NOW,
      ),
    ).toEqual({ accessible: false, reason: 'revoked' });
  });

  it('rejects an expired link', () => {
    expect(
      checkContractTokenAccess(
        {
          status: 'sent',
          public_token_expires_at: '2026-05-01T00:00:00.000Z',
        },
        NOW,
      ),
    ).toEqual({ accessible: false, reason: 'expired' });
  });

  it('rejects a link that expires exactly now', () => {
    expect(
      checkContractTokenAccess(
        {
          status: 'sent',
          public_token_expires_at: NOW.toISOString(),
        },
        NOW,
      ),
    ).toEqual({ accessible: false, reason: 'expired' });
  });

  it('accepts a link with a future expiry', () => {
    expect(
      checkContractTokenAccess(
        {
          status: 'sent',
          public_token_expires_at: '2026-12-01T00:00:00.000Z',
        },
        NOW,
      ),
    ).toEqual({ accessible: true, reason: null });
  });

  it('checks revocation before expiry', () => {
    expect(
      checkContractTokenAccess(
        {
          status: 'sent',
          public_token_revoked_at: '2026-05-01T00:00:00.000Z',
          public_token_expires_at: '2026-05-01T00:00:00.000Z',
        },
        NOW,
      ),
    ).toEqual({ accessible: false, reason: 'revoked' });
  });
});

describe('isContractTokenAccessible', () => {
  it('returns a plain boolean', () => {
    expect(isContractTokenAccessible({ status: 'sent' }, NOW)).toBe(true);
    expect(isContractTokenAccessible({ status: 'draft' }, NOW)).toBe(false);
  });
});
