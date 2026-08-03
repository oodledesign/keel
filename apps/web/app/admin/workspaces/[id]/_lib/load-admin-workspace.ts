import 'server-only';

import { cache } from 'react';

import { notFound } from 'next/navigation';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import {
  resolveWorkspaceProfile,
  workspaceTypeLabel,
} from '~/home/[account]/_lib/workspace-profile';

import type {
  AdminWorkspaceInvitation,
  AdminWorkspaceMember,
} from '../_components/admin-workspace-members-panel';

export type AdminWorkspaceDetail = {
  id: string;
  name: string;
  slug: string;
  workspaceLabel: string;
  primaryOwnerUserId: string;
  createdAt: string | null;
  members: AdminWorkspaceMember[];
  invitations: AdminWorkspaceInvitation[];
};

export const loadAdminWorkspaceDetail = cache(
  async (accountId: string): Promise<AdminWorkspaceDetail> => {
    const admin = getSupabaseServerAdminClient();

    const { data: account, error } = await admin
      .from('accounts')
      .select(
        'id, name, slug, space_type, primary_owner_user_id, created_at, is_personal_account',
      )
      .eq('id', accountId)
      .maybeSingle();

    if (error) throw error;
    if (!account || account.is_personal_account || !account.slug) {
      notFound();
    }

    const [business, memberships, invitations, projectGuests] =
      await Promise.all([
        admin
          .from('businesses')
          .select('type')
          .eq('account_id', accountId)
          .maybeSingle(),
        admin
          .from('accounts_memberships')
          .select('user_id, account_role, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: true }),
        admin
          .from('invitations')
          .select('id, email, role, created_at')
          .eq('account_id', accountId)
          .order('created_at', { ascending: false }),
        admin
          .from('project_guests')
          .select('id, invited_email, status, project_id, created_at')
          .eq('account_id', accountId)
          .eq('status', 'pending')
          .order('created_at', { ascending: false }),
      ]);

    const memberIds = (memberships.data ?? []).map(
      (row) => row.user_id as string,
    );

    const personalAccounts =
      memberIds.length > 0
        ? await admin
            .from('accounts')
            .select('id, name, email')
            .eq('is_personal_account', true)
            .in('id', memberIds)
        : {
            data: [] as Array<{
              id: string;
              name: string | null;
              email: string | null;
            }>,
          };

    const personalById = new Map(
      (personalAccounts.data ?? []).map((row) => [
        row.id as string,
        row as { id: string; name: string | null; email: string | null },
      ]),
    );

    const profile = resolveWorkspaceProfile({
      space_type: account.space_type as string | null,
      business_type: (business.data as { type?: string } | null)?.type ?? null,
    });

    const members: AdminWorkspaceMember[] = (memberships.data ?? []).map(
      (row) => {
        const userId = row.user_id as string;
        const personal = personalById.get(userId);
        return {
          userId,
          name: personal?.name ?? null,
          email: personal?.email ?? null,
          role: String(row.account_role ?? 'staff'),
          isPrimaryOwner: userId === account.primary_owner_user_id,
        };
      },
    );

    const projectIds = [
      ...new Set(
        (projectGuests.data ?? [])
          .map((row) => row.project_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const projectsById = new Map<string, string>();
    if (projectIds.length > 0) {
      const { data: projects } = await admin
        .from('projects')
        .select('id, name, title')
        .eq('account_id', accountId)
        .in('id', projectIds);

      for (const project of (projects ?? []) as Array<{
        id: string;
        name?: string | null;
        title?: string | null;
      }>) {
        const label =
          project.title?.trim() || project.name?.trim() || 'Project';
        projectsById.set(project.id, label);
      }
    }

    const memberInvites: AdminWorkspaceInvitation[] = (
      invitations.data ?? []
    ).map((row) => ({
      id: `member:${row.id as number}`,
      email: String(row.email),
      role: String(row.role),
      kind: 'member' as const,
      status: 'pending' as const,
      createdAt: String(row.created_at),
      projectName: null,
    }));

    const guestInvites: AdminWorkspaceInvitation[] = (
      projectGuests.data ?? []
    ).map((row) => {
      const projectId = row.project_id as string;
      return {
        id: `guest:${row.id as string}`,
        email: String(row.invited_email),
        role: 'project guest',
        kind: 'project_guest' as const,
        status: 'pending' as const,
        createdAt: String(row.created_at),
        projectName: projectsById.get(projectId) ?? null,
      };
    });

    const pendingInvites = [...memberInvites, ...guestInvites].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    return {
      id: account.id as string,
      name: (account.name as string) ?? (account.slug as string),
      slug: account.slug as string,
      workspaceLabel: workspaceTypeLabel(profile),
      primaryOwnerUserId: account.primary_owner_user_id as string,
      createdAt: (account.created_at as string | null) ?? null,
      members,
      invitations: pendingInvites,
    };
  },
);
