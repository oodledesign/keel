'use server';

import { revalidatePath } from 'next/cache';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { isSuperAdmin } from '@kit/admin';
import { enhanceAction } from '@kit/next/actions';
import { Database } from '@kit/supabase/database';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createAccountInvitationsService } from '@kit/team-accounts/services/account-invitations.service';

import {
  type WorkspaceProfile,
  businessTypeForProfile,
  spaceTypeForProfile,
} from '~/home/[account]/_lib/workspace-profile';
import { logAdminAction } from '~/lib/admin/log-admin-action';
import { findPlanByProductAndPlanId } from '~/lib/billing/ozer-plan-catalog';
import {
  ensureEstablishedWorkspaceMembersOnboarded,
  syncWorkspaceStateAfterAdminPlan,
} from '~/lib/billing/sync-workspace-from-admin-grant';

import {
  AddAdminWorkspaceMemberSchema,
  type AdminWorkspaceProfile,
  CreateAdminWorkspaceSchema,
  UpdateAdminWorkspaceMemberRoleSchema,
} from './admin-workspace.schema';

type AdminClient = SupabaseClient<Database>;

async function requireSuperAdmin() {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    throw new Error('Authentication required');
  }

  if (!(await isSuperAdmin(client))) {
    throw new Error('Super admin access required');
  }

  return { client, user };
}

function slugifyName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

async function uniqueSlug(admin: AdminClient, base: string): Promise<string> {
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

function businessTypeForAdminWorkspace(
  profile: AdminWorkspaceProfile,
  businessMode?: 'lite' | 'full',
): string | null {
  if (profile === 'work_property') return 'property';
  if (profile === 'work_design') {
    return businessMode === 'full' ? 'other' : 'lite';
  }
  return businessTypeForProfile(profile as WorkspaceProfile);
}

async function resolveUserIdByEmail(
  admin: AdminClient,
  email: string,
): Promise<string | null> {
  const normalized = email.trim().toLowerCase();

  const { data: personal } = await admin
    .from('accounts')
    .select('id')
    .eq('is_personal_account', true)
    .ilike('email', normalized)
    .maybeSingle();

  if (personal && typeof personal === 'object' && 'id' in personal) {
    return String((personal as { id: string }).id);
  }

  let page = 1;
  for (;;) {
    const { data: listed, error } = await admin.auth.admin.listUsers({
      page,
      perPage: 200,
    });
    if (error) throw new Error(error.message);
    const match = listed.users.find(
      (user) => user.email?.toLowerCase() === normalized,
    );
    if (match) return match.id;
    if (listed.users.length < 200) return null;
    page += 1;
    if (page > 10) return null;
  }
}

async function applyWorkspaceDefaults(
  admin: AdminClient,
  accountId: string,
  profile: AdminWorkspaceProfile,
  businessMode: 'lite' | 'full' | undefined,
  grantedBy: string,
  billingExempt: boolean,
): Promise<void> {
  const looseAdmin = admin as unknown as SupabaseClient;

  if (billingExempt) {
    const { error } = await admin.from('account_billing_exempt').upsert(
      {
        account_id: accountId,
        reason: 'Created by super admin with billing off',
        granted_by: grantedBy,
      },
      { onConflict: 'account_id' },
    );
    if (error) throw new Error(error.message);
  }

  if (profile === 'family') {
    await ensureEstablishedWorkspaceMembersOnboarded(looseAdmin, accountId);
    return;
  }

  let productId: string | null = null;
  let planId: string | null = null;

  if (profile === 'work_design' && businessMode === 'full') {
    productId = 'ozer-business-solo';
    planId = 'business-solo-monthly';
  } else if (profile === 'work_design') {
    productId = 'ozer-business-lite';
    planId = 'business-lite-free';
  } else if (profile === 'work_property') {
    productId = 'ozer-property-starter';
    planId = 'property-starter-monthly';
  } else if (profile === 'community') {
    productId = 'ozer-community';
    planId = 'community-monthly';
  }

  if (productId && planId) {
    const plan = findPlanByProductAndPlanId(productId, planId);
    if (plan) {
      const { error } = await admin.from('account_entitlements').upsert(
        {
          account_id: accountId,
          entitlement_key: plan.entitlementKey,
          source: 'admin_grant',
          granted_by: grantedBy,
          metadata: {
            productId,
            planId,
            source: 'admin_create_workspace',
          },
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'account_id,entitlement_key' },
      );
      if (error) throw new Error(error.message);
      await syncWorkspaceStateAfterAdminPlan(looseAdmin, accountId, plan);
    }
  }

  await ensureEstablishedWorkspaceMembersOnboarded(looseAdmin, accountId);
}

function companyRoleForAccountRole(
  role: string,
): 'admin' | 'staff_member' | 'contractor' | 'client' {
  if (role === 'owner' || role === 'admin') return 'admin';
  if (role === 'contractor') return 'contractor';
  if (role === 'client') return 'client';
  return 'staff_member';
}

function revalidateWorkspacePaths(accountId: string) {
  revalidatePath('/admin/workspaces');
  revalidatePath(`/admin/workspaces/${accountId}`);
  revalidatePath(`/admin/accounts/${accountId}`);
  revalidatePath('/admin/audit');
}

export const createAdminWorkspaceAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const ownerUserId = await resolveUserIdByEmail(admin, input.ownerEmail);
    if (!ownerUserId) {
      throw new Error(
        `No existing user found for ${input.ownerEmail}. Invite them from Users first, or pick an existing owner.`,
      );
    }

    const businessMode =
      input.profile === 'work_design'
        ? (input.businessMode ?? 'lite')
        : undefined;
    const spaceType = spaceTypeForProfile(input.profile as WorkspaceProfile);
    const businessType = businessTypeForAdminWorkspace(
      input.profile,
      businessMode,
    );
    const slug = await uniqueSlug(admin, slugifyName(input.name));

    const { data: account, error } = await admin.rpc('create_team_account', {
      account_name: input.name.trim(),
      user_id: ownerUserId,
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
    if (!accountId) {
      throw new Error('Workspace was created but no id was returned.');
    }

    await applyWorkspaceDefaults(
      admin,
      accountId,
      input.profile,
      businessMode,
      user.id,
      input.billingExempt,
    );

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'create_workspace',
      targetAccountId: accountId,
      metadata: {
        name: input.name,
        slug: created?.slug ?? slug,
        profile: input.profile,
        businessMode: businessMode ?? null,
        billingExempt: input.billingExempt,
        ownerEmail: input.ownerEmail.toLowerCase(),
        ownerUserId,
      },
    });

    revalidateWorkspacePaths(accountId);

    return {
      success: true as const,
      accountId,
      slug: created?.slug ?? slug,
    };
  },
  { schema: CreateAdminWorkspaceSchema },
);

export const addAdminWorkspaceMemberAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const { data: workspace, error: workspaceError } = await admin
      .from('accounts')
      .select('id, slug, is_personal_account')
      .eq('id', input.accountId)
      .maybeSingle();

    if (workspaceError) throw new Error(workspaceError.message);
    if (!workspace || workspace.is_personal_account) {
      throw new Error('Workspace not found');
    }
    if (!workspace.slug) {
      throw new Error('Workspace is missing a slug');
    }

    const existingUserId = await resolveUserIdByEmail(admin, input.email);

    if (existingUserId) {
      const { data: existingMembership } = await admin
        .from('accounts_memberships')
        .select('user_id')
        .eq('account_id', input.accountId)
        .eq('user_id', existingUserId)
        .maybeSingle();

      if (existingMembership) {
        throw new Error('That user is already a member of this workspace');
      }

      const { error } = await admin.from('accounts_memberships').insert({
        account_id: input.accountId,
        user_id: existingUserId,
        account_role: input.role,
        company_role: companyRoleForAccountRole(input.role),
        onboarding_completed: true,
        onboarding_step: 1,
      });

      if (error) throw new Error(error.message);

      await logAdminAction(admin, {
        actorUserId: user.id,
        action: 'add_workspace_member',
        targetAccountId: input.accountId,
        metadata: {
          email: input.email.toLowerCase(),
          userId: existingUserId,
          role: input.role,
          mode: 'existing_user',
        },
      });

      revalidateWorkspacePaths(input.accountId);
      return { success: true as const, mode: 'added' as const };
    }

    const invitations = createAccountInvitationsService(
      admin as unknown as Parameters<typeof createAccountInvitationsService>[0],
    );
    await invitations.sendInvitations({
      accountSlug: workspace.slug,
      invitedBy: user.id,
      invitations: [
        { email: input.email.trim().toLowerCase(), role: input.role },
      ],
    });

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'invite_workspace_member',
      targetAccountId: input.accountId,
      metadata: {
        email: input.email.toLowerCase(),
        role: input.role,
        mode: 'invite',
      },
    });

    revalidateWorkspacePaths(input.accountId);
    return { success: true as const, mode: 'invited' as const };
  },
  { schema: AddAdminWorkspaceMemberSchema },
);

export const updateAdminWorkspaceMemberRoleAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const { data: workspace } = await admin
      .from('accounts')
      .select('id, primary_owner_user_id, is_personal_account')
      .eq('id', input.accountId)
      .maybeSingle();

    if (!workspace || workspace.is_personal_account) {
      throw new Error('Workspace not found');
    }

    if (
      workspace.primary_owner_user_id === input.userId &&
      input.role !== 'owner'
    ) {
      throw new Error('Primary owner must keep the owner role');
    }

    const { error } = await admin
      .from('accounts_memberships')
      .update({ account_role: input.role })
      .eq('account_id', input.accountId)
      .eq('user_id', input.userId);

    if (error) throw new Error(error.message);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'update_workspace_member_role',
      targetAccountId: input.accountId,
      metadata: { userId: input.userId, role: input.role },
    });

    revalidateWorkspacePaths(input.accountId);
    return { success: true as const };
  },
  { schema: UpdateAdminWorkspaceMemberRoleSchema },
);

export const removeAdminWorkspaceMemberAction = enhanceAction(
  async (input) => {
    const { user } = await requireSuperAdmin();
    const admin = getSupabaseServerAdminClient();

    const { data: workspace } = await admin
      .from('accounts')
      .select('id, primary_owner_user_id, is_personal_account')
      .eq('id', input.accountId)
      .maybeSingle();

    if (!workspace || workspace.is_personal_account) {
      throw new Error('Workspace not found');
    }

    if (workspace.primary_owner_user_id === input.userId) {
      throw new Error('Cannot remove the primary owner');
    }

    const { error } = await admin
      .from('accounts_memberships')
      .delete()
      .eq('account_id', input.accountId)
      .eq('user_id', input.userId);

    if (error) throw new Error(error.message);

    await logAdminAction(admin, {
      actorUserId: user.id,
      action: 'remove_workspace_member',
      targetAccountId: input.accountId,
      metadata: { userId: input.userId },
    });

    revalidateWorkspacePaths(input.accountId);
    return { success: true as const };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      userId: z.string().uuid(),
    }),
  },
);
