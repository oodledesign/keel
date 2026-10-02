import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export type ProjectAuditEntityType =
  | 'task'
  | 'project'
  | 'phase'
  | 'note'
  | 'guest';

export type ProjectAuditActor = {
  id: string;
  name: string | null;
  pictureUrl: string | null;
  roleLabel: string;
  isGuest: boolean;
};

export type ProjectAuditEvent = {
  id: string;
  accountId: string;
  projectId: string;
  projectName: string | null;
  actorUserId: string | null;
  actor: ProjectAuditActor | null;
  entityType: ProjectAuditEntityType;
  entityId: string;
  action: 'created' | 'updated' | 'deleted';
  summary: string;
  changes: Record<string, unknown>;
  createdAt: string;
};

type AuditRow = {
  id: string;
  account_id: string;
  project_id: string;
  actor_user_id: string | null;
  entity_type: string;
  entity_id: string;
  action: string;
  summary: string;
  changes: Record<string, unknown> | null;
  created_at: string;
};

// New tables may lag generated Database types — loose table access
function fromTable(client: SupabaseClient, table: string) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from(table);
}

export async function listProjectAuditLog(
  client: SupabaseClient,
  params: {
    accountId: string;
    projectId?: string;
    entityType?: ProjectAuditEntityType;
    limit?: number;
    offset?: number;
  },
): Promise<ProjectAuditEvent[]> {
  const limit = Math.min(Math.max(params.limit ?? 50, 1), 100);
  const offset = Math.max(params.offset ?? 0, 0);

  let query = fromTable(client, 'project_audit_log')
    .select(
      'id, account_id, project_id, actor_user_id, entity_type, entity_id, action, summary, changes, created_at',
    )
    .eq('account_id', params.accountId)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (params.projectId) {
    query = query.eq('project_id', params.projectId);
  }
  if (params.entityType) {
    query = query.eq('entity_type', params.entityType);
  }

  const { data: rows, error } = await query;
  if (error || !rows || rows.length === 0) {
    return [];
  }

  const typedRows = rows as AuditRow[];
  const admin = getSupabaseServerAdminClient();

  // Distinct actors and projects to resolve
  const actorIds = [
    ...new Set(
      typedRows.map((r) => r.actor_user_id).filter(Boolean) as string[],
    ),
  ];
  const projectIds = [
    ...new Set(typedRows.map((r) => r.project_id).filter(Boolean) as string[]),
  ];

  // Resolve actor user info, memberships and guest statuses in parallel
  const [accountsRes, membershipsRes, guestsRes, projectsRes] =
    await Promise.all([
      actorIds.length > 0
        ? admin
            .from('accounts')
            .select('id, name, picture_url, email')
            .in('id', actorIds)
        : Promise.resolve({ data: [] }),
      actorIds.length > 0
        ? admin
            .from('accounts_memberships')
            .select('user_id, account_role')
            .eq('account_id', params.accountId)
            .in('user_id', actorIds)
        : Promise.resolve({ data: [] }),
      actorIds.length > 0
        ? fromTable(admin, 'project_guests')
            .select('user_id, project_id, status, invited_email')
            .in('user_id', actorIds)
            .eq('account_id', params.accountId)
            .eq('status', 'accepted')
        : Promise.resolve({ data: [] }),
      projectIds.length > 0
        ? admin.from('projects').select('id, name, title').in('id', projectIds)
        : Promise.resolve({ data: [] }),
    ]);

  const actorAccountMap = new Map(
    (accountsRes.data ?? []).map((acc) => [
      acc.id as string,
      {
        name: (acc.name as string | null) ?? null,
        pictureUrl: (acc.picture_url as string | null) ?? null,
        email: (acc.email as string | null) ?? null,
      },
    ]),
  );

  const membershipMap = new Map(
    (membershipsRes.data ?? []).map((m) => [
      m.user_id as string,
      m.account_role as string,
    ]),
  );

  const guestUserSet = new Set(
    ((guestsRes.data ?? []) as Array<{ user_id: string }>).map(
      (g) => g.user_id,
    ),
  );

  const projectMap = new Map(
    (projectsRes.data ?? []).map((p) => {
      const title =
        ((p as { title?: string | null }).title?.trim() ||
          (p as { name?: string | null }).name?.trim()) ??
        null;
      return [p.id as string, title];
    }),
  );

  function maskEmail(email: string): string {
    const [local, domain] = email.split('@');
    if (!local || !domain) return 'User';
    const visible = local.length > 2 ? local.slice(0, 2) : local.slice(0, 1);
    return `${visible}***@${domain}`;
  }

  return typedRows.map((row) => {
    let actor: ProjectAuditActor | null = null;
    if (row.actor_user_id) {
      const info = actorAccountMap.get(row.actor_user_id);
      const role = membershipMap.get(row.actor_user_id);
      const isGuest = guestUserSet.has(row.actor_user_id) && !role;

      let roleLabel = 'Member';
      if (isGuest) {
        roleLabel = 'Guest';
      } else if (role === 'owner') {
        roleLabel = 'Owner';
      } else if (role === 'admin') {
        roleLabel = 'Admin';
      }

      actor = {
        id: row.actor_user_id,
        name: info?.name || (info?.email ? maskEmail(info.email) : 'User'),
        pictureUrl: info?.pictureUrl ?? null,
        roleLabel,
        isGuest,
      };
    }

    return {
      id: row.id,
      accountId: row.account_id,
      projectId: row.project_id,
      projectName: projectMap.get(row.project_id) ?? null,
      actorUserId: row.actor_user_id,
      actor,
      entityType: row.entity_type as ProjectAuditEntityType,
      entityId: row.entity_id,
      action: row.action as ProjectAuditEvent['action'],
      summary: row.summary,
      changes: (row.changes ?? {}) as Record<string, unknown>,
      createdAt: row.created_at,
    };
  });
}
