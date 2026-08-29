import { z } from 'zod';

export const ADMIN_WORKSPACE_ROLES = [
  'owner',
  'admin',
  'staff',
  'contractor',
  'client',
] as const;

export type AdminWorkspaceRole = (typeof ADMIN_WORKSPACE_ROLES)[number];

export const ADMIN_WORKSPACE_PROFILES = [
  'work_design',
  'work_property',
  'commercial_property',
  'building_surveyor',
  'family',
  'community',
] as const;

export type AdminWorkspaceProfile = (typeof ADMIN_WORKSPACE_PROFILES)[number];

export const CreateAdminWorkspaceSchema = z.object({
  name: z.string().trim().min(1).max(80),
  ownerEmail: z.string().email(),
  profile: z.enum(ADMIN_WORKSPACE_PROFILES),
  businessMode: z.enum(['lite', 'full']).optional(),
  billingExempt: z.boolean(),
});

export type CreateAdminWorkspaceInput = z.infer<
  typeof CreateAdminWorkspaceSchema
>;

export const AddAdminWorkspaceMemberSchema = z.object({
  accountId: z.string().uuid(),
  email: z.string().email(),
  role: z.enum(ADMIN_WORKSPACE_ROLES),
  /** Commercial Property only — ignored for other profiles. */
  seatKind: z.enum(['billable', 'support']).default('billable'),
});

export type AddAdminWorkspaceMemberInput = z.infer<
  typeof AddAdminWorkspaceMemberSchema
>;

export const UpdateAdminWorkspaceMemberRoleSchema = z.object({
  accountId: z.string().uuid(),
  userId: z.string().uuid(),
  role: z.enum(ADMIN_WORKSPACE_ROLES),
});

export type UpdateAdminWorkspaceMemberRoleInput = z.infer<
  typeof UpdateAdminWorkspaceMemberRoleSchema
>;

export const ResendAdminWorkspaceInviteSchema = z.object({
  accountId: z.string().uuid(),
  invitationId: z.number().int().positive(),
});

export type ResendAdminWorkspaceInviteInput = z.infer<
  typeof ResendAdminWorkspaceInviteSchema
>;

/** Same shape as resend — account-scoped invitation action. */
export const DeleteAdminWorkspaceInviteSchema =
  ResendAdminWorkspaceInviteSchema;

export type DeleteAdminWorkspaceInviteInput = z.infer<
  typeof DeleteAdminWorkspaceInviteSchema
>;

export const ResendAllAdminWorkspaceInvitesSchema = z.object({
  accountId: z.string().uuid(),
});

export type ResendAllAdminWorkspaceInvitesInput = z.infer<
  typeof ResendAllAdminWorkspaceInvitesSchema
>;
