import { describe, expect, it, vi } from 'vitest';

import {
  readTeamAccountFromRpc,
  slugifyWorkspaceName,
  uniqueWorkspaceSlug,
} from './team-account-rpc';

describe('readTeamAccountFromRpc', () => {
  it('reads a single object row', () => {
    expect(readTeamAccountFromRpc({ id: 'acc-1', slug: 'tik' })).toEqual({
      id: 'acc-1',
      slug: 'tik',
    });
  });

  it('reads the first row of an array payload', () => {
    expect(readTeamAccountFromRpc([{ id: 'acc-1', slug: 'tik' }])).toEqual({
      id: 'acc-1',
      slug: 'tik',
    });
  });

  it('returns null for empty payloads', () => {
    expect(readTeamAccountFromRpc(null)).toBeNull();
    expect(readTeamAccountFromRpc([])).toBeNull();
    expect(readTeamAccountFromRpc({})).toBeNull();
  });
});

describe('slugifyWorkspaceName', () => {
  it('slugifies short company names used in onboarding', () => {
    expect(slugifyWorkspaceName('TIK')).toBe('tik');
    expect(slugifyWorkspaceName('Trauma Informed Kent')).toBe(
      'trauma-informed-kent',
    );
  });
});

describe('uniqueWorkspaceSlug', () => {
  it('avoids slugs already taken on businesses even when accounts is free', async () => {
    const lookup = vi.fn(
      async (table: 'accounts' | 'businesses', slug: string) => {
        return table === 'businesses' && slug === 'tik';
      },
    );

    await expect(uniqueWorkspaceSlug(lookup, 'tik')).resolves.toBe('tik-1');
    expect(lookup).toHaveBeenCalledWith('businesses', 'tik');
  });
});
