import { z } from 'zod';

import { loadUserWorkspaces, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

export const registerWorkspaceTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'list_workspaces',
    {
      description:
        'List Ozer workspaces the authenticated user belongs to (team and personal). OAuth is user-level and is not bound to a single workspace. Use account_id from this list to scope list_tasks, list_projects, or list_pipeline_deals. Prefer the active business/work workspace when the user asks about current client work.',
      inputSchema: z.object({}),
    },
    async () => {
      const workspaces = await loadUserWorkspaces(supabase, userId);

      return toolJson({
        workspaces,
        count: workspaces.length,
        hint:
          workspaces.length > 1
            ? 'Multiple workspaces found. Pass account_id to list_tasks to show one workspace. Default list_tasks includes outstanding tasks across all of them.'
            : 'Pass this account_id to list_tasks only when you need to label or restrict results.',
      });
    },
  );
};
