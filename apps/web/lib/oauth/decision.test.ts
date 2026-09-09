import { describe, expect, it } from 'vitest';

import {
  getOAuthDecisionRedirectUrl,
  isSafeOAuthRedirectUrl,
  isTrustedOAuthDecisionRequest,
  isUuidLikeAuthorizationId,
  parseOAuthDecision,
  summarizeSupabaseAuthError,
  wantsJsonOAuthDecisionResponse,
} from './decision';

describe('oauth decision helpers', () => {
  it('accepts only approve or deny', () => {
    expect(parseOAuthDecision('approve')).toBe('approve');
    expect(parseOAuthDecision('deny')).toBe('deny');
    expect(parseOAuthDecision('Approve')).toBeNull();
    expect(parseOAuthDecision('')).toBeNull();
  });

  it('reads redirect_url and the documented redirect_to alias', () => {
    expect(
      getOAuthDecisionRedirectUrl({
        redirect_url: 'https://claude.ai/oauth/callback?code=abc',
      }),
    ).toBe('https://claude.ai/oauth/callback?code=abc');

    expect(
      getOAuthDecisionRedirectUrl({
        redirect_to: 'https://chatgpt.com/connector/oauth/cb',
      }),
    ).toBe('https://chatgpt.com/connector/oauth/cb');

    expect(
      getOAuthDecisionRedirectUrl({
        redirect_url: 'javascript:alert(1)',
      }),
    ).toBeNull();
  });

  it('rejects unsafe redirect protocols', () => {
    expect(isSafeOAuthRedirectUrl('https://chatgpt.com/ok')).toBe(true);
    expect(isSafeOAuthRedirectUrl('javascript:alert(1)')).toBe(false);
  });

  it('trusts same-origin browser form posts', () => {
    const origin = 'https://app.ozer.so';

    expect(
      isTrustedOAuthDecisionRequest(
        new Request('https://app.ozer.so/api/oauth/decision', {
          method: 'POST',
          headers: { origin },
        }),
        origin,
      ),
    ).toBe(true);

    expect(
      isTrustedOAuthDecisionRequest(
        new Request('https://app.ozer.so/api/oauth/decision', {
          method: 'POST',
          headers: {
            referer: 'https://app.ozer.so/oauth/consent?authorization_id=x',
          },
        }),
        origin,
      ),
    ).toBe(true);

    expect(
      isTrustedOAuthDecisionRequest(
        new Request('https://app.ozer.so/api/oauth/decision', {
          method: 'POST',
          headers: { origin: 'https://evil.example' },
        }),
        origin,
      ),
    ).toBe(false);

    expect(
      isTrustedOAuthDecisionRequest(
        new Request('https://app.ozer.so/api/oauth/decision', {
          method: 'POST',
          headers: { origin: 'https://app.ozer.so' },
        }),
        'https://www.ozer.so',
      ),
    ).toBe(true);
  });

  it('prefers HTML for browser Accept headers', () => {
    expect(
      wantsJsonOAuthDecisionResponse(
        new Request('https://app.ozer.so/api/oauth/decision', {
          headers: { accept: 'text/html,application/xhtml+xml' },
        }),
      ),
    ).toBe(false);

    expect(
      wantsJsonOAuthDecisionResponse(
        new Request('https://app.ozer.so/api/oauth/decision', {
          headers: { accept: 'application/json' },
        }),
      ),
    ).toBe(true);
  });

  it('summarizes supabase errors without extra fields', () => {
    expect(
      summarizeSupabaseAuthError({
        message: 'Authorization request not found',
        status: 404,
        code: 'oauth_authorization_not_found',
        name: 'AuthApiError',
      }),
    ).toEqual({
      code: 'oauth_authorization_not_found',
      status: 404,
      name: 'AuthApiError',
      message: 'Authorization request not found',
    });
  });

  it('detects uuid-shaped authorization ids', () => {
    expect(
      isUuidLikeAuthorizationId('2c1d0e3a-7b9f-4a21-9c0d-1234567890ab'),
    ).toBe(true);
    expect(isUuidLikeAuthorizationId('not-a-uuid')).toBe(false);
  });
});
