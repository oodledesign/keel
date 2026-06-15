import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import pathsConfig from '~/config/paths.config';
import {
  businessTypeForProfile,
  spaceTypeForProfile,
  type WorkspaceProfile,
} from '~/home/[account]/_lib/server/workspace-profile';
import { logAdminAction } from '~/lib/admin/log-admin-action';
import {
  type AdminInviteWorkspaceProfile,
  type AdminUserInviteAccessConfig,
  parseAdminUserInviteAccessConfig,
  summarizeAccessConfig,
} from '~/lib/admin/user-invites.schema';
import {
  findPlanByProductAndPlanId,
  type KeelAddonKey,
} from '~/lib/billing/keel-plan-catalog';
import { syncAddonModulesFromEntitlements } from '~/lib/billing/sync-addon-modules-from-entitlements';
import {
  ensureEstablishedWorkspaceMembersOnboarded,
  syncWorkspaceStateAfterAdminGrant,
  syncWorkspaceStateAfterAdminPlan,
} from '~/lib/billing/sync-workspace-from-admin-grant';
import { sendPlatformEmail } from '~/lib/server/send-platform-email';

import type { AdminUserInviteRow } from './user-invites.schema';

export type { AdminUserInviteRow };

const WORKSPACE_PLAN_PRESETS: Partial<
  Record<
    AdminInviteWorkspaceProfile,
    { productId: string; planId: string; businessMode?: 'lite' | 'full' }
  >
> = {
  work_design: {
    productId: 'keel-business-lite',
    planId: 'business-lite-free',
    businessMode: 'lite',
  },
  work_property: {
    productId: 'keel-property-starter',
    planId: 'property-starter-monthly',
  },
  community: {
    productId: 'keel-community',
    planId: 'community-monthly',
  },
};

const FULL_BUSINESS_PLAN = {
  productId: 'keel-business-solo',
  planId: 'business-solo-monthly',
};

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(
  admin: SupabaseClient,
  base: string,
): Promise<string> {
  let candidate = base || 'workspace';
  let n = 0;

  for (;;) {
    const { data } = await admin
      .from('accounts')
      .select('id')
      .eq('slug', candidate)
      .maybeSingle();

    if (!data) {
      return candidate;
    }

    n += 1;
    candidate = `${base}-${n}`;
  }
}

function businessTypeForInviteWorkspace(
  profile: AdminInviteWorkspaceProfile,
  businessMode?: 'lite' | 'full',
): string | null {
  if (profile === 'work_property') {
    return 'property';
  }

  if (profile === 'work_design') {
    return businessMode === 'full' ? 'other' : 'lite';
  }

  return businessTypeForProfile(profile as WorkspaceProfile);
}

function toWorkspaceProfile(
  profile: AdminInviteWorkspaceProfile,
): WorkspaceProfile {
  return profile as WorkspaceProfile;
}

async function grantEntitlementOnAccount(
  admin: SupabaseClient,
  accountId: string,
  entitlementKey: string,
  grantedBy: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  const { error } = await admin.from('account_entitlements').upsert(
    {
      account_id: accountId,
      entitlement_key: entitlementKey,
      source: 'admin_grant',
      granted_by: grantedBy,
      metadata: metadata ?? {},
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,entitlement_key' },
  );

  if (error) {
    throw new Error(error.message);
  }

  await syncWorkspaceStateAfterAdminGrant(admin, accountId, entitlementKey);
}

async function applyPlanPreset(
  admin: SupabaseClient,
  accountId: string,
  productId: string,
  planId: string,
  grantedBy: string,
): Promise<void> {
  const plan = findPlanByProductAndPlanId(productId, planId);

  if (!plan) {
    throw new Error(`Unknown plan ${productId}/${planId}`);
  }

  await admin.from('account_entitlements').upsert(
    {
      account_id: accountId,
      entitlement_key: plan.entitlementKey,
      source: 'admin_grant',
      granted_by: grantedBy,
      metadata: { productId: plan.productId, planId: plan.planId },
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id,entitlement_key' },
  );

  await admin.from('account_plan_limits').upsert(
    {
      account_id: accountId,
      plan_product_id: plan.productId,
      plan_id: plan.planId,
      plan_family: plan.family,
      max_members: plan.limits.maxMembers,
      max_properties: plan.limits.maxProperties,
      max_videos: plan.limits.maxVideos,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'account_id' },
  );

  await syncWorkspaceStateAfterAdminPlan(admin, accountId, plan);
}

async function setBillingExemptOnAccount(
  admin: SupabaseClient,
  accountId: string,
  grantedBy: string,
): Promise<void> {
  const { error } = await admin.from('account_billing_exempt').upsert(
    {
      account_id: accountId,
      reason: 'Admin user invite',
      granted_by: grantedBy,
    },
    { onConflict: 'account_id' },
  );

  if (error) {
    throw new Error(error.message);
  }

  await ensureEstablishedWorkspaceMembersOnboarded(admin, accountId);
}

async function grantAddonsOnAccount(
  admin: SupabaseClient,
  accountId: string,
  addons: KeelAddonKey[],
  grantedBy: string,
): Promise<void> {
  for (const addonKey of addons) {
    await grantEntitlementOnAccount(admin, accountId, addonKey, grantedBy, {
      source: 'admin_user_invite',
    });
  }

  await syncAddonModulesFromEntitlements(admin, accountId);
}

async function createInviteWorkspace(
  admin: SupabaseClient,
  userId: string,
  workspace: NonNullable<AdminUserInviteAccessConfig['workspaces']>[number],
): Promise<{ accountId: string; slug: string; profile: AdminInviteWorkspaceProfile }> {
  const name = workspace.name?.trim() || 'Workspace';
  const slug = await uniqueSlug(admin, slugifyName(name));
  const profile = workspace.profile;
  const spaceType = spaceTypeForProfile(toWorkspaceProfile(profile));
  const businessType = businessTypeForInviteWorkspace(
    profile,
    workspace.businessMode,
  );

  const { data: account, error } = await admin.rpc('create_team_account', {
    account_name: name,
    user_id: userId,
    account_slug: slug,
    account_space_type: spaceType,
    account_business_type: businessType,
    account_complete_onboarding: true,
  });

  if (error) {
    throw new Error(error.message);
  }

  const created = account as { id?: string; slug?: string | null } | null;
  const accountId = created?.id;
  const createdSlug = created?.slug?.trim() || slug;

  if (!accountId) {
    throw new Error('Failed to create workspace for invite.');
  }

  return { accountId, slug: createdSlug, profile };
}

async function applyWorkspacePlanForInvite(
  admin: SupabaseClient,
  accountId: string,
  workspace: NonNullable<AdminUserInviteAccessConfig['workspaces']>[number],
  grantedBy: string,
): Promise<void> {
  if (workspace.profile === 'family') {
    return;
  }

  if (workspace.profile === 'work_design' && workspace.businessMode === 'full') {
    await applyPlanPreset(
      admin,
      accountId,
      FULL_BUSINESS_PLAN.productId,
      FULL_BUSINESS_PLAN.planId,
      grantedBy,
    );
    return;
  }

  const preset = WORKSPACE_PLAN_PRESETS[workspace.profile];

  if (!preset) {
    return;
  }

  if (
    workspace.profile === 'work_design' &&
    (workspace.businessMode === 'lite' || !workspace.businessMode)
  ) {
    return;
  }

  await applyPlanPreset(
    admin,
    accountId,
    preset.productId,
    preset.planId,
    grantedBy,
  );
}

function resolveLandingPath(
  config: AdminUserInviteAccessConfig,
  primarySlug: string | null,
): string {
  if (!primarySlug) {
    return pathsConfig.app.home;
  }

  const moduleKey = config.landingModule ?? 'dashboard';

  switch (moduleKey) {
    case 'signatures':
      return pathsConfig.app.accountSignaturesDashboard.replace(
        '[account]',
        primarySlug,
      );
    case 'apps':
      return pathsConfig.app.accountApps.replace('[account]', primarySlug);
    default:
      return pathsConfig.app.accountHome.replace('[account]', primarySlug);
  }
}

export function getAdminUserInviteAcceptUrl(inviteToken: string): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';
  const url = new URL('/join/user-invite/accept', siteUrl);
  url.searchParams.set('invite_token', inviteToken);
  return url.href;
}

export async function sendAdminUserInviteEmail(params: {
  email: string;
  inviteToken: string;
  accessSummary: string;
  inviterName: string;
}): Promise<void> {
  const acceptUrl = getAdminUserInviteAcceptUrl(params.inviteToken);
  const productName = process.env.NEXT_PUBLIC_PRODUCT_NAME ?? 'Keel';
  const sender = process.env.EMAIL_SENDER;

  if (!sender) {
    throw new Error('EMAIL_SENDER is not configured');
  }

  const html = `
    <div style="font-family: system-ui, sans-serif; line-height: 1.5; color: #111;">
      <p>Hi,</p>
      <p>${params.inviterName} invited you to ${productName}.</p>
      <p><strong>Your access:</strong> ${params.accessSummary}</p>
      <p>
        <a href="${acceptUrl}" style="display:inline-block;padding:12px 20px;background:#2a9d8f;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">
          Accept invitation
        </a>
      </p>
      <p style="color:#666;font-size:14px;">This link expires in 30 days. If you did not expect this email, you can ignore it.</p>
    </div>
  `.trim();

  await sendPlatformEmail({
    type: 'invitation',
    mail: {
      to: params.email,
      from: sender,
      subject: `You're invited to ${productName}`,
      html,
    },
    metadata: {
      kind: 'admin_user_invite',
      inviteToken: params.inviteToken,
    },
  });
}

export async function loadAdminUserInviteByToken(
  admin: SupabaseClient,
  inviteToken: string,
): Promise<AdminUserInviteRow | null> {
  const { data, error } = await admin
    .from('admin_user_invites')
    .select('*')
    .eq('invite_token', inviteToken)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return (data as AdminUserInviteRow | null) ?? null;
}

export async function loadPendingAdminUserInvites(
  admin: SupabaseClient,
): Promise<AdminUserInviteRow[]> {
  const { data, error } = await admin
    .from('admin_user_invites')
    .select('*')
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    throw new Error(error.message);
  }

  return (data as AdminUserInviteRow[]) ?? [];
}

export async function createAdminUserInvite(
  admin: SupabaseClient,
  params: {
    email: string;
    invitedBy: string;
    inviterName: string;
    accessConfig: AdminUserInviteAccessConfig;
  },
): Promise<AdminUserInviteRow> {
  const normalizedEmail = params.email.trim().toLowerCase();

  const { data: existingPending } = await admin
    .from('admin_user_invites')
    .select('id')
    .eq('email', normalizedEmail)
    .eq('status', 'pending')
    .gte('expires_at', new Date().toISOString())
    .maybeSingle();

  if (existingPending) {
    throw new Error('A pending invite already exists for this email.');
  }

  const { data, error } = await admin
    .from('admin_user_invites')
    .insert({
      email: normalizedEmail,
      invited_by: params.invitedBy,
      access_config: params.accessConfig,
    })
    .select('*')
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const invite = data as AdminUserInviteRow;

  await sendAdminUserInviteEmail({
    email: normalizedEmail,
    inviteToken: invite.invite_token,
    accessSummary: summarizeAccessConfig(params.accessConfig),
    inviterName: params.inviterName,
  });

  await logAdminAction(admin, {
    actorUserId: params.invitedBy,
    action: 'create_user_invite',
    metadata: {
      inviteId: invite.id,
      email: normalizedEmail,
      accessConfig: params.accessConfig,
    },
  });

  return invite;
}

export async function revokeAdminUserInvite(
  admin: SupabaseClient,
  inviteId: string,
  actorUserId: string,
): Promise<void> {
  const { error } = await admin
    .from('admin_user_invites')
    .update({ status: 'revoked' })
    .eq('id', inviteId)
    .eq('status', 'pending');

  if (error) {
    throw new Error(error.message);
  }

  await logAdminAction(admin, {
    actorUserId,
    action: 'revoke_user_invite',
    metadata: { inviteId },
  });
}

export async function resendAdminUserInvite(
  admin: SupabaseClient,
  inviteId: string,
  inviterName: string,
): Promise<void> {
  const { data, error } = await admin
    .from('admin_user_invites')
    .select('*')
    .eq('id', inviteId)
    .eq('status', 'pending')
    .single();

  if (error || !data) {
    throw new Error('Invite not found or no longer pending.');
  }

  const invite = data as AdminUserInviteRow;
  const config = parseAdminUserInviteAccessConfig(invite.access_config);

  await sendAdminUserInviteEmail({
    email: invite.email,
    inviteToken: invite.invite_token,
    accessSummary: summarizeAccessConfig(config),
    inviterName,
  });
}

export async function fulfillAdminUserInvite(
  admin: SupabaseClient,
  inviteToken: string,
  userId: string,
  userEmail: string,
): Promise<{ redirectTo: string }> {
  const invite = await loadAdminUserInviteByToken(admin, inviteToken);

  if (!invite) {
    throw new Error('Invitation not found.');
  }

  if (invite.status === 'accepted' && invite.accepted_user_id === userId) {
    const config = parseAdminUserInviteAccessConfig(invite.access_config);
    if (config.personalOnly) {
      return { redirectTo: pathsConfig.app.home };
    }

    const { data: membership } = await admin
      .from('accounts_memberships')
      .select('account:accounts!inner(slug, is_personal_account)')
      .eq('user_id', userId)
      .eq('onboarding_completed', true)
      .limit(1)
      .maybeSingle();

    const slug = (
      membership as { account?: { slug?: string | null } | null } | null
    )?.account?.slug;

    return { redirectTo: resolveLandingPath(config, slug ?? null) };
  }

  if (invite.status !== 'pending') {
    throw new Error('Invitation is no longer valid.');
  }

  if (new Date(invite.expires_at).getTime() <= Date.now()) {
    await admin
      .from('admin_user_invites')
      .update({ status: 'expired' })
      .eq('id', invite.id);
    throw new Error('Invitation has expired.');
  }

  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) {
    throw new Error('This invitation was sent to a different email address.');
  }

  const config = parseAdminUserInviteAccessConfig(invite.access_config);
  let primarySlug: string | null = null;
  let landingSlug: string | null = null;

  if (!config.personalOnly) {
    for (const workspace of config.workspaces ?? []) {
      const created = await createInviteWorkspace(admin, userId, workspace);

      if (!primarySlug) {
        primarySlug = created.slug;
      }

      if (
        workspace.profile === 'work_design' ||
        workspace.profile === 'work_property'
      ) {
        landingSlug = created.slug;
      }

      await applyWorkspacePlanForInvite(
        admin,
        created.accountId,
        workspace,
        invite.invited_by,
      );

      if (workspace.profile === 'work_design' && config.addons?.length) {
        await grantAddonsOnAccount(
          admin,
          created.accountId,
          config.addons,
          invite.invited_by,
        );
      }

      if (config.billingExempt) {
        await setBillingExemptOnAccount(
          admin,
          created.accountId,
          invite.invited_by,
        );
      }
    }

    const useWork = (config.workspaces ?? []).some(
      (ws) => ws.profile === 'work_design' || ws.profile === 'work_property',
    );
    const useFamily = (config.workspaces ?? []).some(
      (ws) => ws.profile === 'family',
    );
    const useCommunity = (config.workspaces ?? []).some(
      (ws) => ws.profile === 'community',
    );

    await admin.from('user_settings').upsert({
      user_id: userId,
      use_keel_for_work: useWork,
      use_keel_for_family: useFamily,
      use_keel_for_community: useCommunity,
    });

    await admin
      .from('accounts_memberships')
      .update({ onboarding_completed: true })
      .eq('user_id', userId);
  }

  await admin
    .from('admin_user_invites')
    .update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
      accepted_user_id: userId,
    })
    .eq('id', invite.id);

  await logAdminAction(admin, {
    actorUserId: userId,
    action: 'accept_user_invite',
    metadata: {
      inviteId: invite.id,
      email: invite.email,
    },
  });

  if (config.personalOnly) {
    if (config.billingExempt) {
      await setBillingExemptOnAccount(admin, userId, invite.invited_by);
    }

    for (const addonKey of config.personalAddons ?? []) {
      await grantEntitlementOnAccount(
        admin,
        userId,
        addonKey,
        invite.invited_by,
      );
    }

    const redirectTo =
      config.personalAddons?.includes('addon_email_assistant')
        ? pathsConfig.app.personalEmailAssistant
        : pathsConfig.app.home;

    return { redirectTo };
  }

  return {
    redirectTo: resolveLandingPath(config, landingSlug ?? primarySlug),
  };
}
