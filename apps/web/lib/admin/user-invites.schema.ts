import { z } from 'zod';

import type { KeelAddonKey } from '~/lib/billing/keel-plan-catalog';

export type AdminUserInviteRow = {
  id: string;
  email: string;
  invite_token: string;
  invited_by: string;
  status: string;
  expires_at: string;
  access_config: unknown;
  accepted_at: string | null;
  accepted_user_id: string | null;
  created_at: string;
};

export const ADMIN_INVITE_WORKSPACE_PROFILES = [
  'work_design',
  'work_property',
  'family',
  'community',
] as const;

export type AdminInviteWorkspaceProfile =
  (typeof ADMIN_INVITE_WORKSPACE_PROFILES)[number];

export type AdminUserInviteAccessConfig = {
  /** No pre-created team workspaces — user gets the standard personal onboarding. */
  personalOnly?: boolean;
  billingExempt?: boolean;
  workspaces?: Array<{
    profile: AdminInviteWorkspaceProfile;
    name?: string;
    businessMode?: 'lite' | 'full';
  }>;
  addons?: KeelAddonKey[];
  personalAddons?: Array<'addon_email_assistant'>;
  /** Module key to open after invite is fulfilled (e.g. signatures). */
  landingModule?: string;
};

export const DEFAULT_WORKSPACE_NAMES: Record<AdminInviteWorkspaceProfile, string> =
  {
    work_design: 'My Business',
    work_property: 'My Properties',
    family: 'Our Family',
    community: 'Our Group',
  };

export const ADMIN_INVITE_ADDON_OPTIONS: Array<{
  key: KeelAddonKey;
  label: string;
}> = [
  { key: 'addon_signatures', label: 'Signatures' },
  { key: 'addon_rankly', label: 'Rankly' },
  { key: 'addon_feedflow', label: 'Feedflow' },
  { key: 'addon_videos', label: 'Videos' },
];

export const ADMIN_INVITE_LANDING_MODULES = [
  { key: 'dashboard', label: 'Workspace home' },
  { key: 'signatures', label: 'Signatures' },
  { key: 'apps', label: 'Apps' },
] as const;

const workspaceSelectionSchema = z.object({
  profile: z.enum(ADMIN_INVITE_WORKSPACE_PROFILES),
  name: z.string().trim().min(1).max(80).optional(),
  businessMode: z.enum(['lite', 'full']).optional(),
});

export const CreateAdminUserInviteSchema = z
  .object({
    email: z.string().email(),
    personalOnly: z.boolean(),
    billingExempt: z.boolean(),
    personalAddons: z.array(z.enum(['addon_email_assistant'])),
    workspaces: z.array(workspaceSelectionSchema),
    addons: z.array(
      z.enum([
        'addon_signatures',
        'addon_rankly',
        'addon_feedflow',
        'addon_videos',
      ]),
    ),
    landingModule: z.enum(['dashboard', 'signatures', 'apps']).optional(),
  })
  .superRefine((data, ctx) => {
    if (data.personalOnly && data.workspaces.length > 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Personal-only invites cannot include team workspaces.',
        path: ['workspaces'],
      });
    }

    if (!data.personalOnly && data.workspaces.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Select at least one workspace or choose personal only.',
        path: ['workspaces'],
      });
    }

    const hasBusinessLite = data.workspaces.some(
      (ws) =>
        ws.profile === 'work_design' &&
        (ws.businessMode === 'lite' || !ws.businessMode),
    );

    if (data.addons.length > 0 && !hasBusinessLite && !data.personalOnly) {
      const hasFullBusiness = data.workspaces.some(
        (ws) => ws.profile === 'work_design' && ws.businessMode === 'full',
      );
      if (!hasFullBusiness) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Add-ons require a Business Lite or full Business workspace.',
          path: ['addons'],
        });
      }
    }
  });

export type CreateAdminUserInviteInput = z.infer<
  typeof CreateAdminUserInviteSchema
>;

export function buildAccessConfigFromInput(
  input: CreateAdminUserInviteInput,
): AdminUserInviteAccessConfig {
  return {
    personalOnly: input.personalOnly,
    billingExempt: input.billingExempt,
    workspaces: input.personalOnly
      ? []
      : input.workspaces.map((ws) => ({
          profile: ws.profile,
          name: ws.name?.trim() || DEFAULT_WORKSPACE_NAMES[ws.profile],
          businessMode:
            ws.profile === 'work_design'
              ? (ws.businessMode ?? 'lite')
              : undefined,
        })),
    addons: input.personalOnly ? [] : input.addons,
    personalAddons: input.personalOnly ? input.personalAddons : [],
    landingModule: input.personalOnly ? undefined : input.landingModule,
  };
}

export function parseAdminUserInviteAccessConfig(
  value: unknown,
): AdminUserInviteAccessConfig {
  if (!value || typeof value !== 'object') {
    return {};
  }

  return value as AdminUserInviteAccessConfig;
}

export function summarizeAccessConfig(
  config: AdminUserInviteAccessConfig,
): string {
  if (config.personalOnly) {
    return 'Personal account (free tier)';
  }

  const parts: string[] = [];

  for (const ws of config.workspaces ?? []) {
    if (ws.profile === 'work_design') {
      parts.push(
        ws.businessMode === 'full' ? 'Business workspace' : 'Business Lite',
      );
    } else if (ws.profile === 'work_property') {
      parts.push('Property workspace');
    } else if (ws.profile === 'family') {
      parts.push('Family workspace');
    } else if (ws.profile === 'community') {
      parts.push('Community workspace');
    }
  }

  if (config.personalAddons?.length) {
    parts.push(
      `Personal add-ons: ${config.personalAddons.map((key) => key.replace('addon_', '')).join(', ')}`,
    );
  }

  if (config.addons?.length) {
    parts.push(
      `Add-ons: ${config.addons.map((key) => key.replace('addon_', '')).join(', ')}`,
    );
  }

  if (config.billingExempt) {
    parts.push('Billing exempt');
  }

  return parts.join(' · ') || 'Ozer access';
}
