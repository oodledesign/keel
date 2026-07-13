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
