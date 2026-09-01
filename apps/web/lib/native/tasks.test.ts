import { describe, expect, it, vi } from 'vitest';

import { NativeHttpError } from './http';
import {
  DONE_NATIVE_TASK_DB_STATUSES,
  OPEN_NATIVE_TASK_DB_STATUSES,
  canSeeNativeTask,
  isPersonalNativeWorkspace,
  nativeClientName,
  nativeTaskTitleIlike,
  parseNativeTaskListStatus,
  parseNativeTaskSearch,
  parseOptionalClientId,
  toNativeTask,
} from './task-map';
import { listNativeTasks } from './tasks';
import { uiStatusToDb } from './task-status';
import type { NativeWorkspace } from './workspace-shared';

const personal: NativeWorkspace = {
  id: '11111111-1111-4111-8111-111111111111',
  slug: 'dan',
  name: 'Dan',
  profile: 'personal',
  isPersonal: true,
  image: null,
};

const studio: NativeWorkspace = {
  id: '22222222-2222-4222-8222-222222222222',
  slug: 'oodle',
  name: 'Oodle',
  profile: 'work_design',
  isPersonal: false,
  image: null,
};

const userId = 'user-dan';

describe('native task status', () => {
  it('maps phone statuses onto the tasks table', () => {
    expect(uiStatusToDb('pending')).toBe('todo');
    expect(uiStatusToDb('todo')).toBe('todo');
    expect(uiStatusToDb('in_progress')).toBe('in_progress');
    expect(uiStatusToDb('client_review')).toBe('client_review');
    expect(uiStatusToDb('completed')).toBe('done');
    expect(uiStatusToDb('done')).toBe('done');
  });

  it('rejects unknown statuses', () => {
    expect(() => uiStatusToDb('nope')).toThrow(NativeHttpError);
  });
});

describe('parseOptionalClientId', () => {
  it('accepts a uuid, null to clear, and rejects junk', () => {
    expect(parseOptionalClientId(undefined)).toBeUndefined();
    expect(parseOptionalClientId(null)).toBeNull();
    expect(parseOptionalClientId('')).toBeNull();
    expect(parseOptionalClientId('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')).toBe(
      'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
    );
    expect(() => parseOptionalClientId('not-a-uuid')).toThrow(NativeHttpError);
  });
});

describe('canSeeNativeTask', () => {
  it('shows business tasks even when user_id is null', () => {
    expect(
      canSeeNativeTask(
        {
          id: 't1',
          account_id: studio.id,
          user_id: null,
          assignee_contact_id: null,
        },
        userId,
        studio,
      ),
    ).toBe(true);
  });

  it('shows another member’s workspace task on a business account', () => {
    expect(
      canSeeNativeTask(
        {
          id: 't2',
          account_id: studio.id,
          user_id: 'someone-else',
          assignee_contact_id: null,
        },
        userId,
        studio,
      ),
    ).toBe(true);
  });

  it('hides another member’s personal-account task', () => {
    expect(
      canSeeNativeTask(
        {
          id: 't3',
          account_id: personal.id,
          user_id: 'someone-else',
          assignee_contact_id: null,
        },
        userId,
        personal,
      ),
    ).toBe(false);
  });

  it('shows an unowned personal-account task to the signed-in user', () => {
    expect(
      canSeeNativeTask(
        {
          id: 't4',
          account_id: personal.id,
          user_id: null,
          assignee_contact_id: null,
        },
        userId,
        personal,
      ),
    ).toBe(true);
  });

  it('hides portal-assigned tasks and other workspaces', () => {
    expect(
      canSeeNativeTask(
        {
          id: 't5',
          account_id: studio.id,
          user_id: userId,
          assignee_contact_id: 'contact-1',
        },
        userId,
        studio,
      ),
    ).toBe(false);
    expect(
      canSeeNativeTask(
        {
          id: 't6',
          account_id: personal.id,
          user_id: userId,
        },
        userId,
        studio,
      ),
    ).toBe(false);
  });
});

describe('toNativeTask', () => {
  it('includes client_id and client_name on the phone payload', () => {
    expect(
      toNativeTask(
        {
          id: 't1',
          title: 'Send invoice',
          status: 'todo',
          due_date: '2026-09-02',
          account_id: studio.id,
          client_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        },
        studio,
        'Hope and Wonder',
      ),
    ).toEqual({
      id: 't1',
      title: 'Send invoice',
      status: 'pending',
      due: '2026-09-02',
      workspace: 'oodle',
      client_id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      client_name: 'Hope and Wonder',
    });
  });

  it('resolves client names with the web display rules', () => {
    expect(
      nativeClientName({
        id: 'c1',
        display_name: null,
        first_name: 'Ada',
        last_name: 'Lovelace',
        client_type: 'individual',
      }),
    ).toBe('Ada Lovelace');
  });
});

describe('isPersonalNativeWorkspace', () => {
  it('treats the personal profile as personal-only scoping', () => {
    expect(isPersonalNativeWorkspace(personal)).toBe(true);
    expect(isPersonalNativeWorkspace(studio)).toBe(false);
  });
});

describe('parseNativeTaskListStatus', () => {
  it('defaults to open and accepts done / all', () => {
    expect(parseNativeTaskListStatus(undefined)).toBe('open');
    expect(parseNativeTaskListStatus(null)).toBe('open');
    expect(parseNativeTaskListStatus('')).toBe('open');
    expect(parseNativeTaskListStatus('open')).toBe('open');
    expect(parseNativeTaskListStatus('done')).toBe('done');
    expect(parseNativeTaskListStatus('completed')).toBe('done');
    expect(parseNativeTaskListStatus('ALL')).toBe('all');
  });

  it('rejects unknown list statuses', () => {
    expect(() => parseNativeTaskListStatus('nope')).toThrow(NativeHttpError);
  });
});

describe('parseNativeTaskSearch', () => {
  it('trims, ignores empty, and escapes ilike wildcards', () => {
    expect(parseNativeTaskSearch(undefined)).toBeNull();
    expect(parseNativeTaskSearch('  ')).toBeNull();
    expect(parseNativeTaskSearch(' invoice ')).toBe('invoice');
    expect(nativeTaskTitleIlike('100%_off')).toBe('%100\\%\\_off%');
  });

  it('rejects an oversized q', () => {
    expect(() => parseNativeTaskSearch('x'.repeat(201))).toThrow(NativeHttpError);
  });
});

function createTaskListQuery(rows: unknown[] = []) {
  const result = { data: rows, error: null };
  const chain = {
    select: vi.fn(),
    eq: vi.fn(),
    is: vi.fn(),
    in: vi.fn(),
    order: vi.fn(),
    limit: vi.fn(),
    or: vi.fn(),
    ilike: vi.fn(),
    then(
      onfulfilled: (value: typeof result) => unknown,
      onrejected?: (reason: unknown) => unknown,
    ) {
      return Promise.resolve(result).then(onfulfilled, onrejected);
    },
  };

  for (const key of [
    'select',
    'eq',
    'is',
    'in',
    'order',
    'limit',
    'or',
    'ilike',
  ] as const) {
    chain[key].mockReturnValue(chain);
  }

  return chain;
}

describe('listNativeTasks query params', () => {
  it('filters open statuses by default and a specific client', async () => {
    const chain = createTaskListQuery();
    const from = vi.fn(() => chain);
    const client = { from } as never;
    const clientId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

    await expect(
      listNativeTasks(client, userId, studio, { clientId }),
    ).resolves.toEqual([]);

    expect(from).toHaveBeenCalledWith('tasks');
    expect(chain.eq).toHaveBeenCalledWith('account_id', studio.id);
    expect(chain.is).toHaveBeenCalledWith('assignee_contact_id', null);
    expect(chain.in).toHaveBeenCalledWith('status', [
      ...OPEN_NATIVE_TASK_DB_STATUSES,
    ]);
    expect(chain.eq).toHaveBeenCalledWith('client_id', clientId);
    expect(chain.ilike).not.toHaveBeenCalled();
    expect(chain.or).not.toHaveBeenCalled();
  });

  it('uses done statuses when status=done', async () => {
    const chain = createTaskListQuery();
    const client = { from: vi.fn(() => chain) } as never;

    await expect(
      listNativeTasks(client, userId, studio, { status: 'done' }),
    ).resolves.toEqual([]);

    expect(chain.in).toHaveBeenCalledWith('status', [
      ...DONE_NATIVE_TASK_DB_STATUSES,
    ]);
  });

  it('skips the status filter when status=all', async () => {
    const chain = createTaskListQuery();
    const client = { from: vi.fn(() => chain) } as never;

    await expect(
      listNativeTasks(client, userId, studio, { status: 'all' }),
    ).resolves.toEqual([]);

    expect(chain.in).not.toHaveBeenCalled();
  });

  it('applies an escaped title ilike when q is set', async () => {
    const chain = createTaskListQuery();
    const client = { from: vi.fn(() => chain) } as never;

    await expect(
      listNativeTasks(client, userId, studio, { q: 'invoice' }),
    ).resolves.toEqual([]);

    expect(chain.ilike).toHaveBeenCalledWith(
      'title',
      nativeTaskTitleIlike('invoice'),
    );
  });

  it('keeps personal user scoping when listing all statuses', async () => {
    const chain = createTaskListQuery();
    const client = { from: vi.fn(() => chain) } as never;

    await expect(
      listNativeTasks(client, userId, personal, { status: 'all' }),
    ).resolves.toEqual([]);

    expect(chain.or).toHaveBeenCalledWith(
      `user_id.eq.${userId},user_id.is.null`,
    );
    expect(chain.is).toHaveBeenCalledWith('assignee_contact_id', null);
    expect(chain.in).not.toHaveBeenCalled();
  });
});
