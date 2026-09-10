import { z } from 'zod';

import { loadLinkedNames } from './lookup';
import {
  OPEN_TASK_STATUSES,
  assertSupabaseOk,
  loadUserWorkspaces,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const todayDigestSchema = z.object({
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace id from list_workspaces. Omit to include all authorized workspaces.',
    ),
  limit: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(25)
    .describe('Max tasks per section (overdue, due today, recently updated).'),
});

const DIGEST_SELECT =
  'id, title, status, priority, due_date, updated_at, project_id, client_id, account_id, parent_task_id';

type DigestTaskRow = {
  id: string;
  title: string | null;
  status: string | null;
  priority: string | null;
  due_date: string | null;
  updated_at?: string | null;
  project_id: string | null;
  client_id?: string | null;
  account_id?: string | null;
  parent_task_id?: string | null;
};

function todayYmd(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

export const registerTodayDigestTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'today_digest',
    {
      description:
        'One-shot digest of current outstanding work: overdue, due today, and recently updated (not done/cancelled). Across all authorized workspaces unless account_id is passed. Includes client/project/workspace names. Do not pass a client or project filter.',
      inputSchema: todayDigestSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      if (
        input.account_id &&
        !workspaces.some((workspace) => workspace.id === input.account_id)
      ) {
        throw new Error('Access denied for this workspace');
      }

      const today = todayYmd();

      const base = () => {
        let query = supabase
          .from('tasks')
          .select(DIGEST_SELECT)
          .in('status', [...OPEN_TASK_STATUSES])
          .is('parent_task_id', null);
        if (input.account_id) {
          query = query.eq('account_id', input.account_id);
        }
        return query;
      };

      const overdueQuery = base()
        .lt('due_date', today)
        .order('due_date', { ascending: true, nullsFirst: false })
        .limit(input.limit);

      const dueTodayQuery = base()
        .eq('due_date', today)
        .order('due_date', { ascending: true })
        .limit(input.limit);

      const recentQuery = base()
        .order('updated_at', { ascending: false, nullsFirst: false })
        .limit(input.limit);

      const [overdueResult, dueTodayResult, recentResult] = await Promise.all([
        overdueQuery,
        dueTodayQuery,
        recentQuery,
      ]);

      assertSupabaseOk(overdueResult.data, overdueResult.error, 'load overdue');
      assertSupabaseOk(
        dueTodayResult.data,
        dueTodayResult.error,
        'load due today',
      );
      assertSupabaseOk(
        recentResult.data,
        recentResult.error,
        'load recently updated',
      );

      const overdue = (overdueResult.data ?? []) as DigestTaskRow[];
      const dueToday = (dueTodayResult.data ?? []) as DigestTaskRow[];
      const seen = new Set([...overdue, ...dueToday].map((row) => row.id));
      const recentlyUpdated = (
        (recentResult.data ?? []) as DigestTaskRow[]
      ).filter((row) => !seen.has(row.id));

      const extras = await loadLinkedNames(
        supabase,
        [...overdue, ...dueToday, ...recentlyUpdated],
        workspaces,
      );

      const mapRow = (row: DigestTaskRow) => ({
        id: row.id,
        title: row.title,
        status: row.status,
        priority: row.priority,
        due_date: row.due_date,
        updated_at: row.updated_at ?? null,
        project_id: row.project_id,
        client_id: row.client_id ?? null,
        account_id: row.account_id ?? null,
        ...(extras.get(row.id) ?? {}),
      });

      return toolJson({
        as_of: today,
        overdue: overdue.map(mapRow),
        due_today: dueToday.map(mapRow),
        recently_updated: recentlyUpdated.map(mapRow),
        meta: {
          overdue_count: overdue.length,
          due_today_count: dueToday.length,
          recently_updated_count: recentlyUpdated.length,
          limit: input.limit,
          scoped_account_id: input.account_id ?? null,
          workspaces,
          hint: 'Outstanding root tasks only. Pass account_id from list_workspaces to focus one workspace.',
        },
      });
    },
  );
};
