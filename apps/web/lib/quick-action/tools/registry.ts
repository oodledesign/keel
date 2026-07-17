import 'server-only';

import type { QuickActionContext } from '../context';
import type { ProposedQuickAction } from '../types';
import {
  handleListWorkspaceAssignmentsTool,
  listWorkspaceAssignmentsToolDefinition,
} from './list-assignments';
import {
  handleListRanklyProjectsTool,
  listRanklyProjectsToolDefinition,
} from './list-rankly-projects';
import {
  handleListWorkspacesTool,
  listWorkspacesToolDefinition,
} from './list-workspaces';
import {
  handleProposeCreateTaskTool,
  proposeCreateTaskToolDefinition,
} from './propose-create-task';
import {
  handleProposePagespeedTool,
  proposePagespeedToolDefinition,
} from './propose-pagespeed';

export const quickActionToolDefinitions = [
  listWorkspacesToolDefinition,
  listWorkspaceAssignmentsToolDefinition,
  listRanklyProjectsToolDefinition,
  proposeCreateTaskToolDefinition,
  proposePagespeedToolDefinition,
];

const PROPOSE_TOOL_NAMES = new Set([
  'propose_create_task',
  'propose_pagespeed_scan',
]);

export async function runQuickActionTool(
  ctx: QuickActionContext,
  name: string,
  input: unknown,
): Promise<{ result: unknown; proposedAction?: ProposedQuickAction }> {
  switch (name) {
    case 'list_workspaces':
      return { result: await handleListWorkspacesTool(ctx) };
    case 'list_workspace_assignments':
      return { result: await handleListWorkspaceAssignmentsTool(ctx, input) };
    case 'list_rankly_projects':
      return { result: await handleListRanklyProjectsTool(ctx, input) };
    case 'propose_create_task': {
      const proposed = await handleProposeCreateTaskTool(ctx, input);
      return {
        result: { status: 'proposed', preview: proposed.preview },
        proposedAction: proposed,
      };
    }
    case 'propose_pagespeed_scan': {
      const proposed = await handleProposePagespeedTool(ctx, input);
      return {
        result: { status: 'proposed', preview: proposed.preview },
        proposedAction: proposed,
      };
    }
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export function isProposeTool(name: string): boolean {
  return PROPOSE_TOOL_NAMES.has(name);
}
