import type { SupabaseClient } from '@supabase/supabase-js';

import { describe, expect, it } from 'vitest';

import {
  loadTaskAssigneeNames,
  loadTaskAssigneeOptions,
  resolveTaskAssigneePatch,
} from './assignees';
import { createTaskSchema, updateTaskSchema } from './tasks';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const MEMBER_ID = '22222222-2222-4222-8222-222222222222';
const CONTACT_ID = '33333333-3333-4333-8333-333333333333';
const CLIENT_ID = '44444444-4444-4444-8444-444444444444';
const ACCOUNT_ID = '55555555-5555-4555-8555-555555555555';
const OTHER_ACCOUNT_ID = '66666666-6666-4666-8666-666666666666';

type Tables = Record<string, unknown[]>;

/** Minimal chainable Supabase stub: filters rows by eq/in and resolves lists. */
function createSupabase(tables: Tables) {
  return {
    from(table: string) {
      let rows = [...((tables[table] ?? []) as Array<Record<string, unknown>>)];

      const builder = {
        select() {
          return builder;
        },
        eq(column: string, value: unknown) {
          rows = rows.filter((row) => row[column] === value);
          return builder;
        },
        in(column: string, values: unknown[]) {
          rows = rows.filter((row) => values.includes(row[column]));
          return builder;
        },
        order() {
          return builder;
        },
        limit(count: number) {
          rows = rows.slice(0, count);
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: rows[0] ?? null, error: null });
        },
        then(resolve: (value: { data: unknown[]; error: null }) => unknown) {
          return Promise.resolve({ data: rows, error: null }).then(resolve);
        },
      };

      return builder;
    },
  } as unknown as SupabaseClient;
}

const workspaceTables: Tables = {
  accounts_memberships: [
    { account_id: ACCOUNT_ID, user_id: USER_ID },
    { account_id: ACCOUNT_ID, user_id: MEMBER_ID },
  ],
  accounts: [
    { id: USER_ID, name: 'Dan', email: 'dan@example.com' },
    { id: MEMBER_ID, name: 'Priya', email: 'priya@example.com' },
  ],
  contacts: [
    {
      id: CONTACT_ID,
      account_id: ACCOUNT_ID,
      client_id: null,
      full_name: 'Sam Client',
      email: 'sam@client.com',
    },
    {
      id: '77777777-7777-4777-8777-777777777777',
      account_id: ACCOUNT_ID,
      client_id: null,
      full_name: 'Unlinked Person',
      email: null,
    },
  ],
  client_contacts: [{ client_id: CLIENT_ID, contact_id: CONTACT_ID }],
};

const task = { accountId: ACCOUNT_ID, clientId: CLIENT_ID };

describe('resolveTaskAssigneePatch', () => {
  it('returns an empty patch when no assignee field is provided', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        {},
        task,
      ),
    ).resolves.toEqual({});
  });

  it('assigns a workspace team member as the owner and clears any contact', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: MEMBER_ID },
        task,
      ),
    ).resolves.toEqual({ user_id: MEMBER_ID, assignee_contact_id: null });
  });

  it('rejects a team member outside the task workspace', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: MEMBER_ID },
        { accountId: OTHER_ACCOUNT_ID, clientId: null },
      ),
    ).rejects.toThrow('not a member');
  });

  it('rejects assigning another member on a task without a workspace', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: MEMBER_ID },
        { accountId: null, clientId: null },
      ),
    ).rejects.toThrow('requires a workspace task');
  });

  it('allows assigning to yourself on a personal task', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: USER_ID },
        { accountId: null, clientId: null },
      ),
    ).resolves.toEqual({ user_id: USER_ID, assignee_contact_id: null });
  });

  it('assigns a contact linked to the task client and keeps the caller as owner', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_contact_id: CONTACT_ID },
        task,
      ),
    ).resolves.toEqual({ user_id: USER_ID, assignee_contact_id: CONTACT_ID });
  });

  it('rejects a contact not linked to the task client', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_contact_id: '77777777-7777-4777-8777-777777777777' },
        task,
      ),
    ).rejects.toThrow('not linked to this task’s client');
  });

  it('accepts any workspace contact when the task has no client', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_contact_id: '77777777-7777-4777-8777-777777777777' },
        { accountId: ACCOUNT_ID, clientId: null },
      ),
    ).resolves.toMatchObject({ assignee_contact_id: expect.any(String) });
  });

  it('rejects a contact from another workspace', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_contact_id: CONTACT_ID },
        { accountId: OTHER_ACCOUNT_ID, clientId: null },
      ),
    ).rejects.toThrow('Contact not found');
  });

  it('rejects providing both a member and a contact', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: MEMBER_ID, assignee_contact_id: CONTACT_ID },
        task,
      ),
    ).rejects.toThrow('not both');
  });

  it('resets to the caller when assignee_user_id is null', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: null },
        task,
      ),
    ).resolves.toEqual({ user_id: USER_ID, assignee_contact_id: null });
  });

  it('resets to the caller when both fields are null', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_user_id: null, assignee_contact_id: null },
        task,
      ),
    ).resolves.toEqual({ user_id: USER_ID, assignee_contact_id: null });
  });

  it('clears only the contact when assignee_contact_id is null', async () => {
    await expect(
      resolveTaskAssigneePatch(
        createSupabase(workspaceTables),
        USER_ID,
        { assignee_contact_id: null },
        task,
      ),
    ).resolves.toEqual({ assignee_contact_id: null });
  });
});

describe('loadTaskAssigneeOptions', () => {
  it('lists members and all workspace contacts', async () => {
    const options = await loadTaskAssigneeOptions(
      createSupabase(workspaceTables),
      { accountId: ACCOUNT_ID },
    );

    expect(options.map((option) => option.kind)).toEqual([
      'member',
      'member',
      'contact',
      'contact',
    ]);
  });

  it('limits contacts to the client but keeps team members', async () => {
    const options = await loadTaskAssigneeOptions(
      createSupabase(workspaceTables),
      { accountId: ACCOUNT_ID, clientId: CLIENT_ID },
    );

    expect(options.filter((o) => o.kind === 'contact')).toEqual([
      {
        kind: 'contact',
        id: CONTACT_ID,
        name: 'Sam Client',
        email: 'sam@client.com',
      },
    ]);
    expect(options.filter((o) => o.kind === 'member')).toHaveLength(2);
  });

  it('filters by name or email', async () => {
    const options = await loadTaskAssigneeOptions(
      createSupabase(workspaceTables),
      { accountId: ACCOUNT_ID, q: 'priya' },
    );

    expect(options).toEqual([
      {
        kind: 'member',
        id: MEMBER_ID,
        name: 'Priya',
        email: 'priya@example.com',
      },
    ]);
  });
});

describe('loadTaskAssigneeNames', () => {
  it('resolves contact and member assignee names', async () => {
    const names = await loadTaskAssigneeNames(createSupabase(workspaceTables), [
      { id: 'task-a', user_id: USER_ID, assignee_contact_id: CONTACT_ID },
      { id: 'task-b', user_id: MEMBER_ID, assignee_contact_id: null },
    ]);

    expect(names.get('task-a')).toEqual({
      assignee_kind: 'contact',
      assignee_name: 'Sam Client',
    });
    expect(names.get('task-b')).toEqual({
      assignee_kind: 'member',
      assignee_name: 'Priya',
    });
  });
});

describe('task schemas', () => {
  it('accepts assignee ids on create and rejects non-uuids', () => {
    expect(
      createTaskSchema.parse({
        title: 'Call',
        assignee_contact_id: CONTACT_ID,
      }),
    ).toMatchObject({ assignee_contact_id: CONTACT_ID });
    expect(() =>
      createTaskSchema.parse({ title: 'Call', assignee_user_id: 'nope' }),
    ).toThrow();
  });

  it('allows null on update to clear an assignee', () => {
    expect(
      updateTaskSchema.parse({ id: CONTACT_ID, assignee_contact_id: null }),
    ).toMatchObject({ assignee_contact_id: null });
  });
});
