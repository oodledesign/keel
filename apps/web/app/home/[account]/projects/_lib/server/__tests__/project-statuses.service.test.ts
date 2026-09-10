import { describe, expect, it, vi } from 'vitest';

import { createProjectStatusesService } from '../project-statuses.service';

vi.mock('@kit/supabase/require-user', () => ({
  requireUser: vi.fn(async () => ({ data: { id: 'user-1' } })),
}));

function createMockClient(options?: {
  listRows?: Array<Record<string, unknown>>;
  insertRow?: Record<string, unknown>;
  count?: number;
  rpcError?: { message: string } | null;
}) {
  const listRows = options?.listRows ?? [];
  const chain: Record<string, unknown> = {};
  Object.assign(chain, {
    select: vi.fn().mockReturnValue(chain),
    insert: vi.fn().mockReturnValue(chain),
    update: vi.fn().mockReturnValue(chain),
    delete: vi.fn().mockReturnValue(chain),
    eq: vi.fn().mockReturnValue(chain),
    order: vi.fn().mockReturnValue(chain),
    single: vi.fn().mockResolvedValue({
      data: options?.insertRow ?? null,
      error: null,
    }),
    maybeSingle: vi.fn().mockResolvedValue({
      data: listRows[0] ?? null,
      error: null,
    }),
    then: undefined,
  });

  // list() uses order() as the terminal call
  (chain.order as ReturnType<typeof vi.fn>).mockImplementation(() => ({
    order: vi.fn().mockResolvedValue({ data: listRows, error: null }),
    then: (resolve: (value: unknown) => void) =>
      resolve({ data: listRows, error: null }),
  }));

  const from = vi.fn((table: string) => {
    if (table === 'accounts_memberships') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              maybeSingle: vi.fn().mockResolvedValue({
                data: { account_role: 'owner' },
                error: null,
              }),
            }),
          }),
        }),
      };
    }
    if (table === 'projects') {
      return {
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({
                count: options?.count ?? 0,
                error: null,
              }),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockResolvedValue({ error: null }),
            }),
          }),
        }),
      };
    }
    return chain;
  });

  return {
    from,
    rpc: vi.fn().mockResolvedValue({ error: options?.rpcError ?? null }),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
  } as never;
}

describe('ProjectStatusesService', () => {
  it('creates a custom status such as Invoiced', async () => {
    const insertRow = {
      id: 'status-1',
      account_id: 'acc-1',
      slug: 'invoiced',
      label: 'Invoiced',
      color: '#41606F',
      sort_order: 5,
      is_default: false,
      category: 'open',
    };
    const client = createMockClient({ insertRow });
    const service = createProjectStatusesService(client);

    const result = await service.create({
      accountId: 'acc-1',
      label: 'Invoiced',
      category: 'open',
    });

    expect(result.slug).toBe('invoiced');
    expect(result.label).toBe('Invoiced');
  });

  it('blocks delete when projects still use the status', async () => {
    const existing = {
      id: 'status-1',
      account_id: 'acc-1',
      slug: 'invoiced',
      label: 'Invoiced',
      color: '#41606F',
      sort_order: 5,
      is_default: false,
      category: 'open',
    };
    const pending = {
      id: 'status-2',
      account_id: 'acc-1',
      slug: 'pending',
      label: 'Pending',
      color: '#41606F',
      sort_order: 0,
      is_default: true,
      category: 'open',
    };
    const client = createMockClient({
      listRows: [pending, existing],
      count: 3,
    });
    const service = createProjectStatusesService(client);

    await expect(
      service.delete({ accountId: 'acc-1', id: 'status-1' }),
    ).rejects.toThrow(/3 projects use this status/i);
  });
});
