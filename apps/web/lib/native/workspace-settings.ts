import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { createAccountInvitationsService } from '@kit/team-accounts/services/account-invitations.service';

import { assertMemberInviteAllowed } from '~/lib/billing/entitlements';
import { syncWorkspaceLogo } from '~/lib/brand/sync-workspace-logo';
import { uploadWorkspaceLogo } from '~/lib/brand/upload-workspace-logo';

import type { NativeAuthContext } from './auth';
import { NativeHttpError } from './http';
import {
  type NativeMemberRow,
  canEditWorkspaceDetails,
  invitableRoles,
  nativeRoleLabel,
  readNativeImageFile,
  toNativeMembers,
} from './settings-shared';
import { type NativeWorkspace, requireNativeWorkspace } from './workspace';

type Requester = Pick<NativeAuthContext, 'userId' | 'supabase'>;

type WorkspaceSettingsContext = {
  workspace: NativeWorkspace;
  members: NativeMemberRow[];
  currentLevel: number | null;
  isPrimaryOwner: boolean;
  canEdit: boolean;
  canManageMembers: boolean;
  canInvite: boolean;
};

async function hasPermission(
  client: SupabaseClient,
  userId: string,
  accountId: string,
  permission: string,
) {
  const { data } = await client.rpc('has_permission', {
    user_id: userId,
    account_id: accountId,
    permission_name: permission,
  });
  return data === true;
}

async function loadContext(
  requester: Requester,
  workspaceRef: string,
): Promise<WorkspaceSettingsContext> {
  const { supabase, userId } = requester;
  const workspace = await requireNativeWorkspace(
    supabase,
    userId,
    workspaceRef,
  );

  if (workspace.isPersonal) {
    return {
      workspace,
      members: [],
      currentLevel: null,
      isPrimaryOwner: true,
      canEdit: false,
      canManageMembers: false,
      canInvite: false,
    };
  }

  const [membership, members, canManageMembers, canInvite] = await Promise.all([
    supabase
      .from('accounts_memberships')
      .select('account_role, company_role')
      .eq('account_id', workspace.id)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase.rpc('get_account_members', { account_slug: workspace.slug }),
    hasPermission(supabase, userId, workspace.id, 'members.manage'),
    hasPermission(supabase, userId, workspace.id, 'invites.manage'),
  ]);

  if (members.error) throw members.error;

  const rows = (members.data ?? []) as NativeMemberRow[];
  const me = rows.find((row) => row.user_id === userId);

  return {
    workspace,
    members: rows,
    currentLevel: me?.role_hierarchy_level ?? null,
    isPrimaryOwner: me?.primary_owner_user_id === userId,
    canEdit: canEditWorkspaceDetails(
      (membership.data as {
        account_role?: string | null;
        company_role?: string | null;
      } | null) ?? {},
    ),
    canManageMembers,
    canInvite,
  };
}

async function requireTeamContext(requester: Requester, workspaceRef: string) {
  const context = await loadContext(requester, workspaceRef);
  if (context.workspace.isPersonal) {
    throw new NativeHttpError(
      400,
      'Your Personal workspace is managed in Personal settings.',
    );
  }
  return context;
}

export async function loadNativeWorkspaceSettings(
  requester: Requester,
  workspaceRef: string,
) {
  const context = await loadContext(requester, workspaceRef);
  const { workspace } = context;

  const base = {
    workspace: {
      id: workspace.id,
      slug: workspace.slug,
      name: workspace.name,
      profile: workspace.profile,
      is_personal: workspace.isPersonal,
      image: workspace.image ?? null,
    },
  };

  if (workspace.isPersonal) {
    return {
      ...base,
      me: {
        role_label: 'Owner',
        is_primary_owner: true,
        can_edit: false,
        can_manage_members: false,
        can_invite: false,
        can_leave: false,
      },
      members: [],
      invitations: [],
      invite_roles: [],
    };
  }

  const { supabase, userId } = requester;
  const [invitations, roles] = await Promise.all([
    context.canInvite
      ? supabase.rpc('get_account_invitations', {
          account_slug: workspace.slug,
        })
      : Promise.resolve({ data: [], error: null }),
    context.canInvite
      ? supabase.from('roles').select('name, hierarchy_level')
      : Promise.resolve({ data: [], error: null }),
  ]);

  if (invitations.error) throw invitations.error;
  if (roles.error) throw roles.error;

  const me = context.members.find((row) => row.user_id === userId);

  return {
    ...base,
    me: {
      role_label: nativeRoleLabel(me?.role),
      is_primary_owner: context.isPrimaryOwner,
      can_edit: context.canEdit,
      can_manage_members: context.canManageMembers,
      can_invite: context.canInvite,
      can_leave: !context.isPrimaryOwner,
    },
    members: toNativeMembers(context.members, {
      currentUserId: userId,
      currentLevel: context.currentLevel,
      canManageMembers: context.canManageMembers,
    }),
    invitations: (
      (invitations.data ?? []) as Array<{
        id: number;
        email: string;
        role: string;
        created_at: string;
        expires_at: string;
      }>
    ).map((invite) => ({
      id: invite.id,
      email: invite.email,
      role_label: nativeRoleLabel(invite.role),
      invited_at: invite.created_at,
      expires_at: invite.expires_at,
    })),
    invite_roles: invitableRoles(
      (roles.data ?? []) as Array<{ name: string; hierarchy_level: number }>,
      context.currentLevel,
    ),
  };
}

function requireEditor(context: WorkspaceSettingsContext) {
  if (!context.canEdit) {
    throw new NativeHttpError(
      403,
      'Only workspace owners and admins can change these settings.',
    );
  }
}

export async function renameNativeWorkspace(
  requester: Requester,
  workspaceRef: string,
  name: string,
) {
  const context = await requireTeamContext(requester, workspaceRef);
  requireEditor(context);

  const { error } = await getSupabaseServerAdminClient()
    .from('accounts')
    .update({ name, updated_at: new Date().toISOString() })
    .eq('id', context.workspace.id);
  if (error) throw error;

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function uploadNativeWorkspaceLogo(
  requester: Requester,
  workspaceRef: string,
  file: Blob | null,
) {
  const image = readNativeImageFile(file);
  const context = await requireTeamContext(requester, workspaceRef);
  requireEditor(context);

  await uploadWorkspaceLogo({
    accountId: context.workspace.id,
    variant: 'primary',
    bytes: Buffer.from(await image.file.arrayBuffer()),
    contentType: image.contentType,
  });

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function removeNativeWorkspaceLogo(
  requester: Requester,
  workspaceRef: string,
) {
  const context = await requireTeamContext(requester, workspaceRef);
  requireEditor(context);

  await syncWorkspaceLogo(context.workspace.id, null);

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function inviteNativeWorkspaceMembers(
  requester: Requester,
  workspaceRef: string,
  invitations: Array<{
    first_name: string;
    last_name: string;
    email: string;
    role: string;
  }>,
) {
  const { supabase, userId } = requester;
  const context = await requireTeamContext(requester, workspaceRef);

  if (!context.canInvite) {
    throw new NativeHttpError(
      403,
      'You do not have permission to invite members',
    );
  }

  for (const role of new Set(invitations.map((invite) => invite.role))) {
    const [elevated, sameLevel] = await Promise.all([
      supabase.rpc('has_more_elevated_role', {
        target_user_id: userId,
        target_account_id: context.workspace.id,
        role_name: role,
      }),
      supabase.rpc('has_same_role_hierarchy_level', {
        target_user_id: userId,
        target_account_id: context.workspace.id,
        role_name: role,
      }),
    ]);
    if (!elevated.data && !sameLevel.data) {
      throw new NativeHttpError(
        403,
        `You cannot invite members with the "${nativeRoleLabel(role)}" role`,
      );
    }
  }

  const existing = new Set(
    context.members.map((member) => member.email?.toLowerCase()),
  );
  const alreadyMember = invitations.find((invite) =>
    existing.has(invite.email),
  );
  if (alreadyMember) {
    throw new NativeHttpError(
      409,
      `${alreadyMember.email} is already in this workspace.`,
    );
  }

  const seats = await assertMemberInviteAllowed(
    supabase,
    context.workspace.id,
    invitations.length,
    { seatKinds: invitations.map(() => 'billable' as const) },
  );
  if (!seats.allowed) {
    throw new NativeHttpError(
      409,
      seats.reason ?? 'Team member limit reached for your plan.',
    );
  }

  await createAccountInvitationsService(
    getSupabaseServerAdminClient(),
  ).sendInvitations({
    accountSlug: context.workspace.slug,
    invitedBy: userId,
    invitations: invitations.map((invite) => ({
      firstName: invite.first_name,
      lastName: invite.last_name,
      email: invite.email,
      role: invite.role,
      projectId: null,
      seatKind: 'billable' as const,
    })),
  });

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function cancelNativeWorkspaceInvitation(
  requester: Requester,
  workspaceRef: string,
  invitationId: number,
) {
  const context = await requireTeamContext(requester, workspaceRef);
  if (!context.canInvite) {
    throw new NativeHttpError(
      403,
      'You do not have permission to manage invites',
    );
  }

  const { data, error } = await requester.supabase
    .from('invitations')
    .delete()
    .eq('id', invitationId)
    .eq('account_id', context.workspace.id)
    .select('id');
  if (error) throw error;
  if (!data?.length) {
    throw new NativeHttpError(404, 'Invitation not found');
  }

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function removeNativeWorkspaceMember(
  requester: Requester,
  workspaceRef: string,
  memberUserId: string,
) {
  const { supabase } = requester;
  const context = await requireTeamContext(requester, workspaceRef);

  if (memberUserId === requester.userId) {
    throw new NativeHttpError(400, 'Use Leave workspace to remove yourself.');
  }

  const { data: allowed } = await supabase.rpc('can_action_account_member', {
    target_team_account_id: context.workspace.id,
    target_user_id: memberUserId,
  });
  if (allowed !== true) {
    throw new NativeHttpError(403, 'You cannot remove this member.');
  }

  const { error } = await supabase
    .from('accounts_memberships')
    .delete()
    .match({ account_id: context.workspace.id, user_id: memberUserId });
  if (error) throw error;

  return loadNativeWorkspaceSettings(requester, workspaceRef);
}

export async function leaveNativeWorkspace(
  requester: Requester,
  workspaceRef: string,
) {
  const context = await requireTeamContext(requester, workspaceRef);
  if (context.isPrimaryOwner) {
    throw new NativeHttpError(
      409,
      'You own this workspace. Transfer ownership on the website before leaving.',
    );
  }

  const { error } = await getSupabaseServerAdminClient()
    .from('accounts_memberships')
    .delete()
    .match({ account_id: context.workspace.id, user_id: requester.userId });
  if (error) throw error;

  return { ok: true as const };
}
