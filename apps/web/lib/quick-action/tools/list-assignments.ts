import 'server-only';

import { z } from 'zod';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';

import { assertAccountMember } from '../module-access';
import { fuzzyMatchByName } from '../fuzzy-match';
import type { QuickActionContext } from '../context';

const listAssignmentsSchema = z.object({
  account_id: z.string().uuid(),
  query: z.string().trim().optional(),
});

export async function listWorkspaceAssignments(
  ctx: QuickActionContext,
  input: z.infer<typeof listAssignmentsSchema>,
) {
  const parsed = listAssignmentsSchema.parse(input);
  await assertAccountMember(ctx.client, ctx.userId, parsed.account_id);

  const readDb = await getDbForWorkspaceTaskAssignmentOptions(
    ctx.client,
    ctx.userId,
    parsed.account_id,
  );

  const [projectsResult, clientsResult] = await Promise.all([
    readDb
      .from('projects')
      .select('id, name')
      .eq('account_id', parsed.account_id)
      .not('status', 'in', '("completed","cancelled","archived")')
      .order('name', { ascending: true }),
    readDb
      .from('clients')
      .select('id, display_name, first_name, last_name')
      .eq('account_id', parsed.account_id)
      .order('display_name', { ascending: true }),
  ]);

  const projects = (projectsResult.data ?? []).map((row) => ({
    id: (row as { id: string }).id,
    name: (row as { name: string | null }).name ?? 'Untitled project',
    type: 'project' as const,
  }));

  const clients = (clientsResult.data ?? []).map((row) => {
    const r = row as {
      display_name: string | null;
      first_name: string | null;
      last_name: string | null;
    };
    const name =
      r.display_name?.trim() ||
      [r.first_name, r.last_name].filter(Boolean).join(' ').trim() ||
      'Client';
    return { id: (row as { id: string }).id, name, type: 'client' as const };
  });

  if (parsed.query?.trim()) {
    const projectMatches = fuzzyMatchByName(parsed.query, projects, 5);
    const clientMatches = fuzzyMatchByName(parsed.query, clients, 5);
    return {
      projects: projectMatches,
      clients: clientMatches,
    };
  }

  return {
    projects: projects.slice(0, 30),
    clients: clients.slice(0, 30),
  };
}

export const listWorkspaceAssignmentsToolDefinition = {
  name: 'list_workspace_assignments',
  description:
    'List projects and clients in a workspace for linking a task. Optionally filter by query string.',
  input_schema: {
    type: 'object',
    properties: {
      account_id: { type: 'string', description: 'Workspace account UUID' },
      query: {
        type: 'string',
        description: 'Optional name filter for projects/clients',
      },
    },
    required: ['account_id'],
  },
};

export async function handleListWorkspaceAssignmentsTool(
  ctx: QuickActionContext,
  input: unknown,
) {
  return listWorkspaceAssignments(ctx, input as z.infer<typeof listAssignmentsSchema>);
}
