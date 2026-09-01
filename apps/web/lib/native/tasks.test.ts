import { describe, expect, it } from 'vitest';

import { NativeHttpError } from './http';
import {
  canSeeNativeTask,
  isPersonalNativeWorkspace,
  nativeClientName,
  parseOptionalClientId,
  toNativeTask,
} from './task-map';
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
