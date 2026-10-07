import { describe, expect, it } from 'vitest';

import {
  type NativeMemberRow,
  canEditWorkspaceDetails,
  canRemoveMember,
  invitableRoles,
  nativeRoleLabel,
  parseNativeInvitations,
  parseNativePersonalSettingsPatch,
  parseNativeWorkspaceNamePatch,
  splitDisplayName,
  toNativeMembers,
} from './settings-shared';

const OWNER = '00000000-0000-4000-8000-000000000001';
const ADMIN = '00000000-0000-4000-8000-000000000002';
const STAFF = '00000000-0000-4000-8000-000000000003';

function member(
  userId: string,
  role: string,
  level: number,
  overrides: Partial<NativeMemberRow> = {},
): NativeMemberRow {
  return {
    user_id: userId,
    name: role,
    email: `${role}@example.com`,
    picture_url: null,
    role,
    role_hierarchy_level: level,
    primary_owner_user_id: OWNER,
    created_at: null,
    ...overrides,
  };
}

describe('parseNativePersonalSettingsPatch', () => {
  it('keeps known notification keys only', () => {
    expect(
      parseNativePersonalSettingsPatch({
        email_notifications: {
          email_follow_up_reminders: false,
          something_else: true,
        },
      }),
    ).toEqual({ email_notifications: { email_follow_up_reminders: false } });
  });

  it('rejects an empty first name', () => {
    expect(() =>
      parseNativePersonalSettingsPatch({ first_name: '  ' }),
    ).toThrow('First name is required');
  });

  it('trims names', () => {
    expect(
      parseNativePersonalSettingsPatch({ first_name: ' Dan ', last_name: '' }),
    ).toMatchObject({ first_name: 'Dan', last_name: '' });
  });
});

describe('splitDisplayName', () => {
  it('splits on the first space', () => {
    expect(splitDisplayName('Dan James Potter')).toEqual({
      firstName: 'Dan',
      lastName: 'James Potter',
    });
    expect(splitDisplayName(null)).toEqual({ firstName: '', lastName: '' });
  });
});

describe('parseNativeWorkspaceNamePatch', () => {
  it('requires a name', () => {
    expect(() =>
      parseNativeWorkspaceNamePatch({ workspace: 'acme', name: ' ' }),
    ).toThrow('Workspace name is required');
  });
});

describe('parseNativeInvitations', () => {
  const invite = {
    first_name: 'Sam',
    last_name: 'Lee',
    email: 'Sam@Example.com',
    role: 'staff',
  };

  it('lowercases emails', () => {
    expect(
      parseNativeInvitations({ workspace: 'acme', invitations: [invite] })
        .invitations[0]?.email,
    ).toBe('sam@example.com');
  });

  it('rejects duplicate emails', () => {
    expect(() =>
      parseNativeInvitations({
        workspace: 'acme',
        invitations: [invite, { ...invite, email: 'sam@example.com' }],
      }),
    ).toThrow('Duplicate emails are not allowed');
  });

  it('rejects an invalid email', () => {
    expect(() =>
      parseNativeInvitations({
        workspace: 'acme',
        invitations: [{ ...invite, email: 'nope' }],
      }),
    ).toThrow('Enter a valid email address');
  });
});

describe('canEditWorkspaceDetails', () => {
  it('allows owners, admins and company admins', () => {
    expect(canEditWorkspaceDetails({ account_role: 'owner' })).toBe(true);
    expect(canEditWorkspaceDetails({ account_role: 'admin' })).toBe(true);
    expect(canEditWorkspaceDetails({ company_role: 'admin' })).toBe(true);
    expect(canEditWorkspaceDetails({ account_role: 'staff' })).toBe(false);
    expect(
      canEditWorkspaceDetails({ account_role: 'staff', company_role: 'admin' }),
    ).toBe(false);
  });
});

describe('canRemoveMember', () => {
  it('lets the primary owner remove anyone but themselves', () => {
    const input = {
      currentUserId: OWNER,
      currentLevel: 1,
      canManageMembers: true,
    };
    expect(
      canRemoveMember({ ...input, member: member(ADMIN, 'admin', 2) }),
    ).toBe(true);
    expect(
      canRemoveMember({ ...input, member: member(OWNER, 'owner', 1) }),
    ).toBe(false);
  });

  it('needs members.manage and a more senior role', () => {
    const admin = { currentUserId: ADMIN, currentLevel: 2 };
    expect(
      canRemoveMember({
        ...admin,
        canManageMembers: true,
        member: member(STAFF, 'staff', 3),
      }),
    ).toBe(true);
    expect(
      canRemoveMember({
        ...admin,
        canManageMembers: false,
        member: member(STAFF, 'staff', 3),
      }),
    ).toBe(false);
    expect(
      canRemoveMember({
        ...admin,
        canManageMembers: true,
        member: member('00000000-0000-4000-8000-000000000004', 'admin', 2),
      }),
    ).toBe(false);
  });
});

describe('invitableRoles', () => {
  const roles = [
    { name: 'staff', hierarchy_level: 3 },
    { name: 'owner', hierarchy_level: 1 },
    { name: 'admin', hierarchy_level: 2 },
  ];

  it('offers roles at or below your level, most senior first', () => {
    expect(invitableRoles(roles, 2).map((role) => role.name)).toEqual([
      'admin',
      'staff',
    ]);
    expect(invitableRoles(roles, null)).toEqual([]);
  });
});

describe('toNativeMembers', () => {
  it('sorts by seniority and flags you and the owner', () => {
    const result = toNativeMembers(
      [member(STAFF, 'staff', 3), member(OWNER, 'owner', 1)],
      { currentUserId: STAFF, currentLevel: 3, canManageMembers: false },
    );
    expect(result.map((row) => row.user_id)).toEqual([OWNER, STAFF]);
    expect(result[0]).toMatchObject({
      is_primary_owner: true,
      is_me: false,
      can_remove: false,
      role_label: 'Owner',
    });
    expect(result[1]?.is_me).toBe(true);
  });
});

describe('nativeRoleLabel', () => {
  it('capitalises and falls back to Member', () => {
    expect(nativeRoleLabel('admin')).toBe('Admin');
    expect(nativeRoleLabel(null)).toBe('Member');
  });
});
