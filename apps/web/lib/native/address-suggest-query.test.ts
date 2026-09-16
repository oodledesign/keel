import { describe, expect, it } from 'vitest';

import { parseNativeAddressSuggestQuery } from './address-suggest-query';
import { extractNativeBearerToken, looksLikeJwt } from './auth';

function params(query: string) {
  return new URL(`http://localhost/api/native/v1/address-suggest${query}`)
    .searchParams;
}

describe('parseNativeAddressSuggestQuery', () => {
  it('requires a workspace (same as other native GET routes)', () => {
    expect(parseNativeAddressSuggestQuery(params('?q=Bath'))).toEqual({
      ok: false,
      reason: 'workspace',
    });
    expect(
      parseNativeAddressSuggestQuery(params('?workspace=&q=Bath')),
    ).toEqual({ ok: false, reason: 'workspace' });
  });

  it('rejects queries shorter than 3 characters', () => {
    expect(
      parseNativeAddressSuggestQuery(params('?workspace=bracketts&q=Ba')),
    ).toEqual({ ok: false, reason: 'query' });
  });

  it('accepts a UK address query with an optional limit', () => {
    expect(
      parseNativeAddressSuggestQuery(
        params('?workspace=bracketts&q=12%20High%20Street&limit=6'),
      ),
    ).toEqual({
      ok: true,
      data: {
        workspace: 'bracketts',
        q: '12 High Street',
        limit: 6,
      },
    });
  });

  it('rejects a limit outside 1–10', () => {
    expect(
      parseNativeAddressSuggestQuery(
        params('?workspace=bracketts&q=Bath&limit=0'),
      ),
    ).toEqual({ ok: false, reason: 'query' });
    expect(
      parseNativeAddressSuggestQuery(
        params('?workspace=bracketts&q=Bath&limit=11'),
      ),
    ).toEqual({ ok: false, reason: 'query' });
  });
});

describe('native address-suggest auth (shared bearer helper)', () => {
  it('requires a Bearer JWT — Mapbox tokens stay off the iPhone', () => {
    const request = new Request(
      'http://localhost/api/native/v1/address-suggest?workspace=bracketts&q=Bath',
    );
    expect(extractNativeBearerToken(request)).toBeNull();
    expect(looksLikeJwt('mapbox-public-token')).toBe(false);
    expect(
      extractNativeBearerToken(
        new Request('http://localhost/api/native/v1/address-suggest', {
          headers: { authorization: 'Bearer aaa.bbb.ccc' },
        }),
      ),
    ).toBe('aaa.bbb.ccc');
  });
});
