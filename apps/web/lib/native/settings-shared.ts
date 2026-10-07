import { z } from 'zod';

import {
  EMAIL_NOTIFICATION_COPY,
  EMAIL_NOTIFICATION_KEYS,
  type EmailNotificationKey,
} from '~/lib/notifications/email-notification-preferences';

import { NativeHttpError } from './http';

export const NATIVE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

const NameSchema = z.string().trim().max(100);

const PersonalSettingsPatchSchema = z
  .object({
    first_name: NameSchema.optional(),
    last_name: NameSchema.optional(),
    email_notifications: z
      .record(z.string(), z.boolean())
      .optional()
      .transform((value) =>
        value
          ? (Object.fromEntries(
              Object.entries(value).filter(([key]) =>
                (EMAIL_NOTIFICATION_KEYS as readonly string[]).includes(key),
              ),
            ) as Partial<Record<EmailNotificationKey, boolean>>)
          : undefined,
      ),
  })
  .refine((value) => value.first_name === undefined || value.first_name, {
    message: 'First name is required',
  });

export type NativePersonalSettingsPatch = z.infer<
  typeof PersonalSettingsPatchSchema
>;

export function parseNativePersonalSettingsPatch(
  body: unknown,
): NativePersonalSettingsPatch {
  const parsed = PersonalSettingsPatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new NativeHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'Invalid settings',
    );
  }
  return parsed.data;
}

export function splitDisplayName(name: string | null | undefined) {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
  };
}

export function joinDisplayName(firstName: string, lastName: string) {
  return [firstName.trim(), lastName.trim()].filter(Boolean).join(' ');
}

export function toNativeEmailNotifications(
  preferences: Record<EmailNotificationKey, boolean>,
) {
  return EMAIL_NOTIFICATION_KEYS.map((key) => ({
    key,
    title: EMAIL_NOTIFICATION_COPY[key].title,
    description: EMAIL_NOTIFICATION_COPY[key].description,
    enabled: preferences[key],
  }));
}

const WorkspaceRefSchema = z.string().trim().min(1, 'workspace is required');

export function parseNativeWorkspaceNamePatch(body: unknown) {
  const parsed = z
    .object({
      workspace: WorkspaceRefSchema,
      name: z
        .string()
        .trim()
        .min(1, 'Workspace name is required')
        .max(100, 'Workspace name is too long'),
    })
    .safeParse(body);
  if (!parsed.success) {
    throw new NativeHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'Invalid workspace name',
    );
  }
  return parsed.data;
}

export function parseNativeWorkspaceRef(body: unknown) {
  const parsed = z.object({ workspace: WorkspaceRefSchema }).safeParse(body);
  if (!parsed.success) {
    throw new NativeHttpError(400, 'workspace is required');
  }
  return parsed.data.workspace;
}

const InviteSchema = z.object({
  first_name: z.string().trim().min(1, 'First name is required').max(100),
  last_name: z.string().trim().min(1, 'Last name is required').max(100),
  email: z.string().trim().toLowerCase().email('Enter a valid email address'),
  role: z.string().trim().min(1, 'Choose a role').max(100),
});

export function parseNativeInvitations(body: unknown) {
  const parsed = z
    .object({
      workspace: WorkspaceRefSchema,
      invitations: InviteSchema.array().min(1).max(5),
    })
    .safeParse(body);
  if (!parsed.success) {
    throw new NativeHttpError(
      400,
      parsed.error.issues[0]?.message ?? 'Invalid invitation',
    );
  }

  const emails = parsed.data.invitations.map((invite) => invite.email);
  if (new Set(emails).size !== emails.length) {
    throw new NativeHttpError(400, 'Duplicate emails are not allowed');
  }

  return parsed.data;
}

export function nativeRoleLabel(role: string | null | undefined) {
  const value = (role ?? '').trim();
  if (!value) return 'Member';
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/[_-]+/g, ' ');
}

/** Same rule as brand settings: owner, admin, or company admin without an account role. */
export function canEditWorkspaceDetails(membership: {
  account_role?: string | null;
  company_role?: string | null;
}) {
  const accountRole = membership.account_role;
  return (
    accountRole === 'owner' ||
    accountRole === 'admin' ||
    (!accountRole && membership.company_role === 'admin')
  );
}

export type NativeMemberRow = {
  user_id: string;
  name: string | null;
  email: string | null;
  picture_url: string | null;
  role: string | null;
  role_hierarchy_level: number | null;
  primary_owner_user_id: string | null;
  created_at: string | null;
};

/** Mirrors `can_action_account_member`; the database re-checks on remove. */
export function canRemoveMember(input: {
  currentUserId: string;
  currentLevel: number | null;
  canManageMembers: boolean;
  member: NativeMemberRow;
}) {
  const { member, currentUserId } = input;
  if (member.user_id === currentUserId) return false;
  if (member.primary_owner_user_id === member.user_id) return false;
  if (member.primary_owner_user_id === currentUserId) return true;
  if (!input.canManageMembers) return false;
  if (input.currentLevel === null || member.role_hierarchy_level === null) {
    return false;
  }
  return input.currentLevel < member.role_hierarchy_level;
}

export function invitableRoles(
  roles: Array<{ name: string; hierarchy_level: number }>,
  currentLevel: number | null,
) {
  if (currentLevel === null) return [];
  return roles
    .filter((role) => role.hierarchy_level >= currentLevel)
    .sort((a, b) => a.hierarchy_level - b.hierarchy_level)
    .map((role) => ({ name: role.name, label: nativeRoleLabel(role.name) }));
}

export function toNativeMembers(
  rows: NativeMemberRow[],
  input: {
    currentUserId: string;
    currentLevel: number | null;
    canManageMembers: boolean;
  },
) {
  return [...rows]
    .sort(
      (a, b) =>
        (a.role_hierarchy_level ?? 99) - (b.role_hierarchy_level ?? 99) ||
        (a.name ?? a.email ?? '').localeCompare(b.name ?? b.email ?? ''),
    )
    .map((member) => ({
      user_id: member.user_id,
      name: member.name?.trim() || member.email?.split('@')[0] || 'Member',
      email: member.email,
      picture_url: member.picture_url,
      role: member.role,
      role_label: nativeRoleLabel(member.role),
      is_primary_owner: member.primary_owner_user_id === member.user_id,
      is_me: member.user_id === input.currentUserId,
      can_remove: canRemoveMember({ ...input, member }),
    }));
}

export function readNativeImageFile(file: Blob | null) {
  if (!file) {
    throw new NativeHttpError(400, 'file is required');
  }
  const type = file.type || 'image/jpeg';
  if (!type.startsWith('image/')) {
    throw new NativeHttpError(400, 'Only image uploads are allowed.');
  }
  if (file.size > NATIVE_IMAGE_MAX_BYTES) {
    throw new NativeHttpError(400, 'Image is too large. Max size is 5MB.');
  }
  return { file, contentType: type };
}
