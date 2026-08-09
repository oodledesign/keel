import { describe, expect, it } from 'vitest';

import { unwrapListClientsResult } from './unwrap-list-clients-result';

describe('unwrapListClientsResult', () => {
  it('accepts a bare array', () => {
    const rows = [{ id: '1' }];
    expect(unwrapListClientsResult(rows)).toEqual({ ok: true, data: rows });
  });

  it('accepts { data: array }', () => {
    const rows = [{ id: '1' }];
    expect(unwrapListClientsResult({ data: rows, total: 1 })).toEqual({
      ok: true,
      data: rows,
    });
  });

  it('fails on unexpected shapes instead of returning []', () => {
    expect(unwrapListClientsResult(undefined)).toEqual({
      ok: false,
      error: 'Could not load clients',
    });
    expect(unwrapListClientsResult({ data: { nested: true } })).toEqual({
      ok: false,
      error: 'Could not load clients',
    });
    expect(unwrapListClientsResult({ total: 0 })).toEqual({
      ok: false,
      error: 'Could not load clients',
    });
    expect(unwrapListClientsResult({ data: null })).toEqual({
      ok: false,
      error: 'Could not load clients',
    });
  });
});
