import type { SupabaseClient } from '@supabase/supabase-js';

import { describe, expect, it, vi } from 'vitest';

import type { Database } from '~/lib/database.types';

import { assertWorkspaceMember } from './assert-workspace-member';

vi.mock('server-only', () => ({}));

function clientReturning(membership: { account_role: string } | null) {
  const maybeSingle = vi
    .fn()
    .mockResolvedValue({ data: membership, error: null });
  const query = { select: vi.fn(), eq: vi.fn(), maybeSingle };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  const from = vi.fn().mockReturnValue(query);

  return {
    client: { from } as unknown as SupabaseClient<Database>,
    from,
  };
}

describe('assertWorkspaceMember', () => {
  it('allows the owner of a personal account without a membership row', async () => {
    const { client, from } = clientReturning(null);

    await expect(
      assertWorkspaceMember(client, 'user-1', 'user-1'),
    ).resolves.toEqual({ account_role: 'owner' });
    expect(from).not.toHaveBeenCalled();
  });

  it('allows a team member', async () => {
    const { client } = clientReturning({ account_role: 'staff' });

    await expect(
      assertWorkspaceMember(client, 'team-1', 'user-1'),
    ).resolves.toEqual({ account_role: 'staff' });
  });

  it('rejects someone who is not a member', async () => {
    const { client } = clientReturning(null);

    await expect(
      assertWorkspaceMember(client, 'team-1', 'user-1'),
    ).rejects.toThrow('You are not a member of this workspace');
  });
});
