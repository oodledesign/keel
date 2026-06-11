import 'server-only';

import { cache } from 'react';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

export type AdminAuditRow = {
  id: string;
  action: string;
  actorUserId: string;
  actorEmail: string | null;
  targetAccountId: string | null;
  targetAccountName: string | null;
  metadata: Record<string, unknown>;
  createdAt: string;
};

export const loadAdminAuditLogPage = cache(
  async (options: {
    page: number;
    pageSize: number;
  }): Promise<{
    rows: AdminAuditRow[];
    page: number;
    pageSize: number;
    pageCount: number;
  }> => {
    const client = getSupabaseServerClient();
    const admin = getSupabaseServerAdminClient();
    const page = Math.max(1, options.page);
    const pageSize = options.pageSize;
    const from = (page - 1) * pageSize;
    const to = from + pageSize - 1;

    const { data, count, error } = await client
      .from('admin_action_log')
      .select(
        'id, action, actor_user_id, target_account_id, metadata, created_at',
        { count: 'exact' },
      )
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    const rows = data ?? [];
    const actorIds = [...new Set(rows.map((r) => r.actor_user_id as string))];
    const accountIds = [
      ...new Set(
        rows
          .map((r) => r.target_account_id as string | null)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const [actors, accounts] = await Promise.all([
      Promise.all(
        actorIds.map(async (id) => {
          const { data: userResult } = await admin.auth.admin.getUserById(id);
          return {
            id,
            email: userResult.user?.email ?? null,
          };
        }),
      ),
      accountIds.length
        ? client
            .from('accounts')
            .select('id, name, slug')
            .in('id', accountIds)
        : Promise.resolve({ data: [] as { id: string; name: string | null; slug: string | null }[] }),
    ]);

    const emailById = new Map(actors.map((a) => [a.id, a.email]));
    const nameByAccountId = new Map(
      (accounts.data ?? []).map((a) => [
        a.id,
        (a.name ?? a.slug) as string | null,
      ]),
    );

    return {
      rows: rows.map((row) => ({
        id: row.id as string,
        action: row.action as string,
        actorUserId: row.actor_user_id as string,
        actorEmail: emailById.get(row.actor_user_id as string) ?? null,
        targetAccountId: (row.target_account_id as string | null) ?? null,
        targetAccountName: row.target_account_id
          ? (nameByAccountId.get(row.target_account_id as string) ?? null)
          : null,
        metadata: (row.metadata as Record<string, unknown>) ?? {},
        createdAt: row.created_at as string,
      })),
      page,
      pageSize,
      pageCount: Math.ceil((count ?? 0) / pageSize),
    };
  },
);
