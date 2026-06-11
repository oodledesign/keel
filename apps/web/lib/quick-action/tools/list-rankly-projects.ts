import 'server-only';

import { z } from 'zod';

import { loadTeamAccountIdsForUser } from '~/home/_lib/server/workspace-scope';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { fuzzyMatchByName } from '../fuzzy-match';
import type { QuickActionContext } from '../context';

const listRanklySchema = z.object({
  query: z.string().trim().optional(),
  account_id: z.string().uuid().optional(),
});

export async function listRanklyProjects(
  ctx: QuickActionContext,
  input: z.infer<typeof listRanklySchema>,
) {
  const parsed = listRanklySchema.parse(input);
  const accountIds = parsed.account_id
    ? [parsed.account_id]
    : await loadTeamAccountIdsForUser(ctx.client, ctx.userId);

  if (accountIds.length === 0) {
    return { projects: [] as Array<Record<string, string>> };
  }

  const { data, error } = await supabaseCustomSchema(ctx.client, 'rankly')
    .from('projects')
    .select('id, name, domain, account_id')
    .in('account_id', accountIds)
    .order('name', { ascending: true });

  if (error) {
    throw new Error(`Failed to list Rankly projects: ${error.message}`);
  }

  const workspaceByAccountId = new Map(
    ctx.workspaces.map((w) => [w.id, w]),
  );

  const rows = (data ?? []).map((row) => {
    const r = row as {
      id: string;
      name: string;
      domain: string;
      account_id: string;
    };
    const workspace = workspaceByAccountId.get(r.account_id);
    return {
      id: r.id,
      name: r.name,
      domain: r.domain,
      account_id: r.account_id,
      workspace_name: workspace?.name ?? null,
      workspace_slug: workspace?.slug ?? null,
    };
  });

  if (parsed.query?.trim()) {
    const matches = fuzzyMatchByName(parsed.query, rows, 10);
    return { projects: matches };
  }

  return { projects: rows.slice(0, 30) };
}

export const listRanklyProjectsToolDefinition = {
  name: 'list_rankly_projects',
  description:
    'Search Rankly SEO projects across workspaces the user can access. Use query to fuzzy-match by project name (e.g. "arcanum").',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Project name search' },
      account_id: {
        type: 'string',
        description: 'Optional workspace UUID to scope search',
      },
    },
  },
};

export async function handleListRanklyProjectsTool(
  ctx: QuickActionContext,
  input: unknown,
) {
  return listRanklyProjects(ctx, input as z.infer<typeof listRanklySchema>);
}
