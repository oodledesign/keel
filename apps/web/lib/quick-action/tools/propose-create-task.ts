import 'server-only';

import { z } from 'zod';

import { getDbForWorkspaceTaskAssignmentOptions } from '~/home/_lib/server/workspace-scope';

import { assertAccountMember, assertTasksModuleEnabled } from '../module-access';
import { resolveDueDate } from '../relative-dates';
import { signQuickActionToken } from '../action-token';
import type { QuickActionContext } from '../context';
import { workspaceById } from '../context';
import type { ProposedQuickAction } from '../types';

const proposeCreateTaskSchema = z.object({
  account_id: z.string().uuid(),
  title: z.string().trim().min(1).max(500),
  notes: z.string().trim().max(5000).optional().nullable(),
  due_date: z.string().trim().optional().nullable(),
  due_date_phrase: z.string().trim().optional().nullable(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  project_id: z.string().uuid().optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
  project_name: z.string().trim().optional().nullable(),
  client_name: z.string().trim().optional().nullable(),
});

export async function proposeCreateTask(
  ctx: QuickActionContext,
  input: z.infer<typeof proposeCreateTaskSchema>,
): Promise<ProposedQuickAction> {
  const parsed = proposeCreateTaskSchema.parse(input);
  await assertAccountMember(ctx.client, ctx.userId, parsed.account_id);
  await assertTasksModuleEnabled(ctx.client, parsed.account_id);

  const workspace = workspaceById(ctx, parsed.account_id);
  if (!workspace) {
    throw new Error('Workspace not found or not accessible');
  }

  const projectId = parsed.project_id ?? null;
  const clientId = parsed.client_id ?? null;
  let projectName = parsed.project_name?.trim() || null;
  let clientName = parsed.client_name?.trim() || null;

  if (projectId || clientId) {
    const readDb = await getDbForWorkspaceTaskAssignmentOptions(
      ctx.client,
      ctx.userId,
      parsed.account_id,
    );

    if (projectId) {
      const { data: project } = await readDb
        .from('projects')
        .select('id, name, account_id')
        .eq('id', projectId)
        .eq('account_id', parsed.account_id)
        .maybeSingle();
      if (!project) {
        throw new Error('Project not found in this workspace');
      }
      projectName = (project as { name: string | null }).name ?? projectName;
    }

    if (clientId) {
      const { data: clientRow } = await readDb
        .from('clients')
        .select('id, display_name, account_id')
        .eq('id', clientId)
        .eq('account_id', parsed.account_id)
        .maybeSingle();
      if (!clientRow) {
        throw new Error('Client not found in this workspace');
      }
      clientName =
        (clientRow as { display_name: string | null }).display_name ??
        clientName;
    }
  }

  const dueDate = resolveDueDate({
    dueDate: parsed.due_date,
    dueDatePhrase: parsed.due_date_phrase,
  });

  const priority = parsed.priority ?? 'medium';
  const notes = parsed.notes?.trim() || null;

  const actionToken = signQuickActionToken({
    userId: ctx.userId,
    data: {
      type: 'create_task',
      accountId: parsed.account_id,
      title: parsed.title,
      notes,
      dueDate,
      priority,
      projectId,
      clientId,
    },
  });

  return {
    actionToken,
    preview: {
      type: 'create_task',
      workspaceName: workspace.name,
      workspaceSlug: workspace.slug,
      accountId: parsed.account_id,
      title: parsed.title,
      notes,
      dueDate,
      priority,
      projectName,
      clientName,
    },
  };
}

export const proposeCreateTaskToolDefinition = {
  name: 'propose_create_task',
  description:
    'Propose creating a task in a workspace. Call list_workspaces and list_workspace_assignments first to resolve IDs. Returns a preview for user confirmation — does not create the task yet.',
  input_schema: {
    type: 'object',
    properties: {
      account_id: { type: 'string', description: 'Workspace account UUID' },
      title: { type: 'string', description: 'Task title' },
      notes: { type: 'string', description: 'Optional task notes / description' },
      due_date: {
        type: 'string',
        description: 'Due date as YYYY-MM-DD if known',
      },
      due_date_phrase: {
        type: 'string',
        description:
          'Relative due date phrase if due_date is unknown, e.g. "this week", "friday"',
      },
      priority: {
        type: 'string',
        enum: ['low', 'medium', 'high', 'urgent'],
      },
      project_id: { type: 'string', description: 'Optional project UUID' },
      client_id: { type: 'string', description: 'Optional client UUID' },
      project_name: {
        type: 'string',
        description: 'Display name for preview only',
      },
      client_name: {
        type: 'string',
        description: 'Display name for preview only',
      },
    },
    required: ['account_id', 'title'],
  },
};

export async function handleProposeCreateTaskTool(
  ctx: QuickActionContext,
  input: unknown,
): Promise<ProposedQuickAction> {
  return proposeCreateTask(ctx, input as z.infer<typeof proposeCreateTaskSchema>);
}
