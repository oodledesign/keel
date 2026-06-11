import 'server-only';

import type { QuickActionContext } from '../context';

export function listWorkspaces(ctx: QuickActionContext) {
  return {
    workspaces: ctx.workspaces.map((w) => ({
      id: w.id,
      name: w.name,
      slug: w.slug,
      type_label: w.typeLabel,
    })),
    page_context: ctx.pageContext,
  };
}

export const listWorkspacesToolDefinition = {
  name: 'list_workspaces',
  description:
    'List team workspaces the user belongs to (id, name, slug). Use to resolve workspace names like "greentrees".',
  input_schema: {
    type: 'object',
    properties: {},
  },
};

export async function handleListWorkspacesTool(ctx: QuickActionContext) {
  return listWorkspaces(ctx);
}
