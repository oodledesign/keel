'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  extractWorkspaceTasksWithAnthropic,
  resolveDraftAssignment,
  type WorkspaceContextForExtract,
} from '~/lib/ai/workspace-task-extract';

import { createTask, loadTaskAssignmentOptionsForWorkspace } from '~/home/(user)/_lib/actions/task-actions';
import pathsConfig from '~/config/paths.config';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';

function revalidateWorkspaceTaskPages(accountSlug: string) {
  const slug = accountSlug.trim();
  if (!slug) return;
  const workTasks = workAccountPath(pathsConfig.app.accountTasks, slug);
  const workExtract = workAccountPath(pathsConfig.app.accountTasksExtract, slug);
  const workReview = workAccountPath(pathsConfig.app.accountTasksReview, slug);
  const homeTasks = `/home/${slug}/tasks`;
  const homeExtract = `/home/${slug}/tasks/extract`;
  const homeReview = `/home/${slug}/tasks/review`;
  // Use `page` so Next invalidates the concrete route (rewrites can make `layout` alone miss `/app/:slug/...`).
  revalidatePath(workTasks, 'page');
  revalidatePath(workExtract, 'page');
  revalidatePath(workReview, 'page');
  revalidatePath(homeTasks, 'page');
  revalidatePath(homeExtract, 'page');
  revalidatePath(homeReview, 'page');
  revalidatePath('/home', 'layout');
}

const extractSchema = z.object({
  accountId: z.string().uuid(),
  rawText: z.string().min(20).max(120_000),
  /** When extracting from a meeting transcript, prefer this client for all tasks. */
  preferredClientId: z.string().uuid().optional(),
});

export type ExtractedTaskReviewRow = {
  id: string;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  projectId: string | null;
  clientId: string | null;
  included: boolean;
  subtasks: Array<{
    id: string;
    title: string;
    notes: string | null;
    dueDate: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
    included: boolean;
  }>;
};

function randomId() {
  return `draft-${Math.random().toString(36).slice(2, 11)}`;
}

async function assertWorkspaceMember(accountId: string, userId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) {
    throw new Error('You do not have access to this workspace');
  }
}

export const extractWorkspaceTasksFromTranscript = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const options = await loadTaskAssignmentOptionsForWorkspace(
      input.accountId,
    );
    const projects = options
      .filter((o) => o.type === 'project')
      .map((o) => ({ id: o.id, name: o.name }));
    const clients = options
      .filter((o) => o.type === 'client')
      .map((o) => ({ id: o.id, name: o.name }));

    const preferredClient = input.preferredClientId
      ? clients.find((c) => c.id === input.preferredClientId) ?? null
      : null;

    const context: WorkspaceContextForExtract = {
      projects,
      clients,
      meetingClient: preferredClient,
    };
    const drafts = await extractWorkspaceTasksWithAnthropic(
      input.rawText,
      context,
    );

    const rows: ExtractedTaskReviewRow[] = drafts.map((d) => {
      const { projectId, clientId } = resolveDraftAssignment(d, context);
      return {
        id: randomId(),
        title: d.title,
        notes: d.notes,
        dueDate: d.dueDate,
        priority: d.priority,
        projectId,
        clientId: preferredClient?.id ?? clientId,
        included: true,
        subtasks: d.subtasks.map((s) => ({
          id: randomId(),
          title: s.title,
          notes: s.notes,
          dueDate: s.dueDate,
          priority: s.priority,
          included: true,
        })),
      };
    });

    return { rows };
  },
  { schema: extractSchema },
);

const subCommitSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  included: z.boolean(),
});

const commitItemSchema = z.object({
  id: z.string(),
  title: z.string().min(1),
  notes: z.string().nullable().optional(),
  dueDate: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']),
  projectId: z.string().uuid().nullable(),
  clientId: z.string().uuid().nullable(),
  included: z.boolean(),
  subtasks: z.array(subCommitSchema),
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  items: z.array(commitItemSchema),
});

export const commitWorkspaceExtractedTasks = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const options = await loadTaskAssignmentOptionsForWorkspace(
      input.accountId,
    );
    const validProject = new Set(
      options.filter((o) => o.type === 'project').map((o) => o.id),
    );
    const validClient = new Set(
      options.filter((o) => o.type === 'client').map((o) => o.id),
    );

    let created = 0;
    /** When AI only resolves the first group, carry the same link to later parents. */
    let lastValidProjectId: string | null = null;
    let lastValidClientId: string | null = null;

    for (const item of input.items) {
      if (!item.included) continue;

      let projectId =
        item.projectId && validProject.has(item.projectId)
          ? item.projectId
          : null;
      let clientId =
        item.clientId && validClient.has(item.clientId) ? item.clientId : null;

      if (!projectId && !clientId) {
        projectId = lastValidProjectId;
        clientId = lastValidClientId;
      }

      const parentResult = await createTask({
        title: item.title,
        priority: item.priority,
        dueDate: item.dueDate ?? undefined,
        projectId: projectId ?? undefined,
        clientId: clientId ?? undefined,
        accountId: input.accountId,
        notes: item.notes ?? undefined,
      });

      if (!parentResult.success || !parentResult.id) {
        throw new Error(parentResult.error ?? 'Failed to create task');
      }
      created += 1;

      lastValidProjectId = projectId;
      lastValidClientId = clientId;

      for (const st of item.subtasks) {
        if (!st.included) continue;
        const subResult = await createTask({
          title: st.title,
          priority: st.priority,
          dueDate: st.dueDate ?? undefined,
          projectId: projectId ?? undefined,
          clientId: clientId ?? undefined,
          accountId: input.accountId,
          parentTaskId: parentResult.id,
          notes: st.notes ?? undefined,
        });
        if (!subResult.success) {
          throw new Error(subResult.error ?? 'Failed to create subtask');
        }
        created += 1;
      }
    }

    revalidateWorkspaceTaskPages(input.accountSlug);
    return { created };
  },
  { schema: commitSchema },
);
