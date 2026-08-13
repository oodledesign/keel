'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  createTask,
  loadTaskAssignmentOptionsForWorkspace,
} from '~/home/(user)/_lib/actions/task-actions';
import { workAccountPath } from '~/home/[account]/_lib/work-account-path';
import { MAX_EXTRACT_INSTRUCTIONS_LENGTH } from '~/lib/ai/extract-instructions';
import {
  type WorkspaceContextForExtract,
  extractWorkspaceTasksWithAnthropic,
  resolveDraftAssignment,
} from '~/lib/ai/workspace-task-extract';
import {
  parsePersonAssigneeSelectValue,
  personAssigneeSelectValue,
  resolvePersonAssigneeFromSuggestion,
} from '~/lib/tasks/task-person-assignee';
import { loadTaskPersonAssigneeOptions } from '~/lib/tasks/task-person-assignee.server';
function revalidateWorkspaceTaskPages(accountSlug: string) {
  const slug = accountSlug.trim();
  if (!slug) return;
  const workTasks = workAccountPath(pathsConfig.app.accountTasks, slug);
  const workExtract = workAccountPath(
    pathsConfig.app.accountTasksExtract,
    slug,
  );
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
  /** Optional guidance for how the AI should group or phrase extracted tasks. */
  instructions: z.string().max(MAX_EXTRACT_INSTRUCTIONS_LENGTH).optional(),
  /** Meeting / call calendar day (YYYY-MM-DD) for relative deadline interpretation. */
  meetingDateYmd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  /** When set, load calendar attendees for assignee suggestions. */
  meetingTranscriptId: z.string().uuid().optional(),
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
  /** Select value: m:<userId> | c:<contactId> | __none__ */
  personAssignee: string;
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
      ? (clients.find((c) => c.id === input.preferredClientId) ?? null)
      : null;

    const admin = getSupabaseServerAdminClient();
    const personOptions = await loadTaskPersonAssigneeOptions(
      admin,
      input.accountId,
      { clientId: preferredClient?.id ?? input.preferredClientId ?? null },
    );

    let attendees: Array<{ name: string | null; email: string | null }> = [];
    if (input.meetingTranscriptId) {
      const { data: transcript } = await admin
        .from('meeting_transcripts')
        .select('calendar_attendees')
        .eq('id', input.meetingTranscriptId)
        .eq('account_id', input.accountId)
        .maybeSingle();
      const raw = (transcript as { calendar_attendees?: unknown } | null)
        ?.calendar_attendees;
      if (Array.isArray(raw)) {
        attendees = raw.map((row) => {
          const r = row as { name?: unknown; email?: unknown };
          return {
            name: typeof r.name === 'string' ? r.name : null,
            email: typeof r.email === 'string' ? r.email : null,
          };
        });
      }
    }

    const context: WorkspaceContextForExtract = {
      projects,
      clients,
      meetingClient: preferredClient,
      meetingDateYmd: input.meetingDateYmd ?? null,
      attendees,
      members: personOptions
        .filter((o) => o.kind === 'member')
        .map((o) => ({ name: o.label, email: o.email ?? '' }))
        .filter((o) => o.email),
      contacts: personOptions
        .filter((o) => o.kind === 'contact')
        .map((o) => ({ name: o.label, email: o.email })),
    };
    const drafts = await extractWorkspaceTasksWithAnthropic(
      input.rawText,
      context,
      input.instructions,
      { accountId: input.accountId, supabase: getSupabaseServerClient() },
    );

    const rows: ExtractedTaskReviewRow[] = drafts.map((d) => {
      const { projectId, clientId } = resolveDraftAssignment(d, context);
      const matched = resolvePersonAssigneeFromSuggestion(
        {
          email: d.suggestedAssigneeEmail,
          name: d.suggestedAssigneeName,
          kind: d.suggestedAssigneeKind,
        },
        personOptions,
      );
      const personAssignee = matched
        ? personAssigneeSelectValue(
            matched.kind === 'member'
              ? { kind: 'member', userId: matched.id }
              : { kind: 'contact', contactId: matched.id },
          )
        : '__none__';

      return {
        id: randomId(),
        title: d.title,
        notes: d.notes,
        dueDate: d.dueDate,
        priority: d.priority,
        projectId,
        clientId: preferredClient?.id ?? clientId,
        included: true,
        personAssignee,
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

    return { rows, personAssigneeOptions: personOptions };
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
  personAssignee: z.string().optional(),
  subtasks: z.array(subCommitSchema),
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1).max(200),
  items: z.array(commitItemSchema),
  /** When set, link accepted tasks to this meeting for public share. */
  meetingTranscriptId: z.string().uuid().optional(),
});

export const commitWorkspaceExtractedTasks = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const client = getSupabaseServerClient();
    const options = await loadTaskAssignmentOptionsForWorkspace(
      input.accountId,
    );
    const validProject = new Set(
      options.filter((o) => o.type === 'project').map((o) => o.id),
    );
    const validClient = new Set(
      options.filter((o) => o.type === 'client').map((o) => o.id),
    );

    async function resolveClientId(
      candidate: string | null,
    ): Promise<string | null> {
      if (!candidate) return null;
      if (validClient.has(candidate)) return candidate;

      const { data } = await client
        .from('clients')
        .select('id')
        .eq('id', candidate)
        .eq('account_id', input.accountId)
        .maybeSingle();

      return data ? candidate : null;
    }

    if (input.meetingTranscriptId) {
      const { data: transcript, error: transcriptError } = await client
        .from('meeting_transcripts')
        .select('id')
        .eq('id', input.meetingTranscriptId)
        .eq('account_id', input.accountId)
        .maybeSingle();

      if (transcriptError || !transcript) {
        throw new Error('Meeting not found for this workspace');
      }
    }

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
      let clientId = await resolveClientId(item.clientId);

      if (!projectId && !clientId) {
        projectId = lastValidProjectId;
        clientId = lastValidClientId;
      }

      const person = parsePersonAssigneeSelectValue(
        item.personAssignee ?? '__none__',
      );

      let assigneeUserId =
        person.kind === 'member' ? person.id : undefined;
      let assigneeContactId =
        person.kind === 'contact' ? person.id : null;

      if (person.kind === 'member' && person.id) {
        const { data: membership } = await client
          .from('accounts_memberships')
          .select('user_id')
          .eq('account_id', input.accountId)
          .eq('user_id', person.id)
          .maybeSingle();
        if (!membership) {
          assigneeUserId = undefined;
        }
      }

      if (person.kind === 'contact' && person.id) {
        const { data: contact } = await client
          .from('contacts')
          .select('id')
          .eq('id', person.id)
          .eq('account_id', input.accountId)
          .maybeSingle();
        if (!contact) {
          assigneeContactId = null;
        }
      }

      const parentResult = await createTask({
        title: item.title,
        priority: item.priority,
        dueDate: item.dueDate ?? undefined,
        projectId: projectId ?? undefined,
        clientId: clientId ?? undefined,
        accountId: input.accountId,
        notes: item.notes ?? undefined,
        assigneeUserId,
        assigneeContactId,
      });

      if (!parentResult.success || !parentResult.id) {
        throw new Error(parentResult.error ?? 'Failed to create task');
      }
      created += 1;

      if (input.meetingTranscriptId) {
        await client
          .from('tasks')
          .update({ source: 'meeting' })
          .eq('id', parentResult.id)
          .eq('account_id', input.accountId);

        const { error: actionItemError } = await client
          .from('meeting_action_items')
          .insert({
            account_id: input.accountId,
            meeting_transcript_id: input.meetingTranscriptId,
            suggested_title: item.title.trim(),
            suggested_description: item.notes?.trim() || null,
            suggested_due_date: item.dueDate || null,
            status: 'approved',
            planner_task_id: parentResult.id,
            reviewed_at: new Date().toISOString(),
            reviewed_by: user.id,
          });

        if (actionItemError) {
          console.error(
            '[commitWorkspaceExtractedTasks] meeting_action_items:',
            actionItemError.message,
          );
        }
      }

      lastValidProjectId = projectId;
      lastValidClientId = clientId;

      const parentTaskContext = {
        projectId,
        clientId,
        areaId: null as string | null,
        accountId: input.accountId,
      };

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
          parentTaskContext,
          notes: st.notes ?? undefined,
        });
        if (!subResult.success) {
          throw new Error(subResult.error ?? 'Failed to create subtask');
        }
        created += 1;

        if (input.meetingTranscriptId && subResult.id) {
          await client
            .from('tasks')
            .update({ source: 'meeting' })
            .eq('id', subResult.id)
            .eq('account_id', input.accountId);
        }
      }
    }

    revalidateWorkspaceTaskPages(input.accountSlug);
    if (input.meetingTranscriptId) {
      revalidatePath(
        `/home/${input.accountSlug}/meetings/${input.meetingTranscriptId}`,
        'page',
      );
      revalidatePath(
        `/app/${input.accountSlug}/meetings/${input.meetingTranscriptId}`,
        'page',
      );
    }
    return { created };
  },
  { schema: commitSchema },
);
