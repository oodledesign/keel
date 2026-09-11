import { z } from 'zod';

import { createTaskForUser } from '@kit/tasks/create-task';

import { resolveMcpCreateDurationMinutes } from './duration';
import {
  type ParsedExtractTask,
  parseExtractText,
  shouldAutoLink,
} from './extract-text';
import {
  type NameMatch,
  type SearchableNamed,
  findBestNameMatch,
  loadLinkedNames,
  loadSearchableClients,
  loadSearchableProjects,
} from './lookup';
import { assertSupabaseOk, loadUserWorkspaces, toolJson } from './shared';
import type { OzerMcpToolRegistrar } from './types';

const extractPrioritySchema = z.enum(['low', 'medium', 'high', 'urgent']);

// null is treated as omitted and forces server-side estimation.
const extractDurationMinutesSchema = z
  .number()
  .int()
  .positive()
  .max(10080)
  .optional()
  .nullable()
  .describe(
    'Estimated effort in minutes (1–10080). Always include when known; the server estimates from the title and notes if omitted.',
  );

const extractSubtaskInputSchema = z.object({
  title: z.string().trim().min(1),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  duration_minutes: extractDurationMinutesSchema,
  priority: extractPrioritySchema.optional(),
});

const extractItemInputSchema = z.object({
  title: z.string().trim().min(1),
  notes: z.string().optional().nullable(),
  due_date: z.string().optional().nullable(),
  duration_minutes: extractDurationMinutesSchema,
  priority: extractPrioritySchema.optional(),
  client_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  suggested_client_name: z.string().optional().nullable(),
  suggested_project_name: z.string().optional().nullable(),
  subtasks: z.array(extractSubtaskInputSchema).optional(),
});

export const extractTasksSchema = z.object({
  text: z
    .string()
    .trim()
    .min(1)
    .max(20_000)
    .optional()
    .describe('Chat dump or bullet list to parse into tasks.'),
  tasks: z
    .array(extractItemInputSchema)
    .max(50)
    .optional()
    .describe(
      'Optional already-parsed tasks. When omitted, text is parsed into bullets and nested subtasks.',
    ),
  mode: z
    .enum(['dry_run', 'commit'])
    .optional()
    .default('dry_run')
    .describe('dry_run proposes only. commit creates root tasks and subtasks.'),
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe(
      'Workspace to search and attach. Omit to use all authorized workspaces.',
    ),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('Force-link every created task to this CRM client.'),
  project_id: z
    .string()
    .uuid()
    .optional()
    .describe('Force-link every created task to this project.'),
  accept_suggestions: z
    .boolean()
    .optional()
    .default(false)
    .describe(
      'On commit, also link medium-confidence name matches. High-confidence and explicit ids always link.',
    ),
});

function toParsedTasks(
  input: z.infer<typeof extractTasksSchema>,
): ParsedExtractTask[] {
  if (input.tasks?.length) {
    return input.tasks.map((item) => ({
      title: item.title,
      notes: item.notes?.trim() || null,
      due_date: item.due_date?.trim() || null,
      priority: item.priority ?? 'medium',
      suggested_client_name: item.suggested_client_name?.trim() || null,
      suggested_project_name: item.suggested_project_name?.trim() || null,
      subtasks: (item.subtasks ?? []).map((subtask) => ({
        title: subtask.title,
        notes: subtask.notes?.trim() || null,
        due_date: subtask.due_date?.trim() || null,
        priority: subtask.priority ?? 'medium',
      })),
    }));
  }

  return parseExtractText(input.text ?? '');
}

function pickLink(input: {
  explicitId?: string;
  match: NameMatch | null;
  acceptSuggestions: boolean;
}): { id: string | null; confidence: NameMatch['confidence'] | null } {
  if (input.explicitId) {
    return { id: input.explicitId, confidence: 'high' };
  }

  if (
    input.match &&
    shouldAutoLink({
      confidence: input.match.confidence,
      acceptSuggestions: input.acceptSuggestions,
    })
  ) {
    return { id: input.match.id, confidence: input.match.confidence };
  }

  return { id: null, confidence: input.match?.confidence ?? null };
}

function suggestionPayload(match: NameMatch | null, linkedId: string | null) {
  if (!match && !linkedId) {
    return null;
  }

  return {
    id: linkedId ?? match?.id ?? null,
    name: match?.name ?? null,
    confidence: match?.confidence ?? (linkedId ? 'high' : null),
    linked: Boolean(linkedId),
  };
}

export const registerExtractTaskTools: OzerMcpToolRegistrar = (
  server,
  context,
) => {
  const { supabase, userId } = context;

  server.registerTool(
    'extract_tasks',
    {
      description:
        'Turn a chat dump or bullet list into Ozer tasks (root + optional nested subtasks). Default mode=dry_run proposes titles, due dates, duration_minutes, and suggested client/project matches — it does not write. Set mode=commit to create. Always include duration_minutes on each item/subtask when known; if omitted, the server estimates from the title and notes (keyword bands; default 30). Link project/client only when ids are provided or the name match is high confidence (exact). Medium matches stay suggestions unless accept_suggestions=true. Do not invent clients or projects.',
      inputSchema: extractTasksSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (input.account_id && accountIds.length === 0) {
        throw new Error('Access denied for this workspace');
      }

      if (!input.text && !input.tasks?.length) {
        throw new Error('Provide text or a tasks array');
      }

      const parsed = toParsedTasks(input);
      if (parsed.length === 0) {
        return toolJson({
          mode: input.mode,
          proposed: [],
          created: [],
          hint: 'No tasks found. Use bullets (- item) or pass a tasks array.',
        });
      }

      const [clients, projects] = await Promise.all([
        loadSearchableClients(supabase, accountIds),
        loadSearchableProjects(supabase, accountIds),
      ]);

      const clientIndex: SearchableNamed[] = clients;
      const projectIndex: SearchableNamed[] = projects;

      const proposed = parsed.map((item, index) => {
        const structured = input.tasks?.[index];
        const clientMatch = findBestNameMatch(
          item.suggested_client_name,
          clientIndex,
        );
        const projectMatch = findBestNameMatch(
          item.suggested_project_name,
          projectIndex,
        );
        const client = pickLink({
          explicitId: input.client_id ?? structured?.client_id,
          match: clientMatch,
          acceptSuggestions: input.accept_suggestions,
        });
        const project = pickLink({
          explicitId: input.project_id ?? structured?.project_id,
          match: projectMatch,
          acceptSuggestions: input.accept_suggestions,
        });

        return {
          title: item.title,
          notes: item.notes,
          due_date: item.due_date,
          duration_minutes: resolveMcpCreateDurationMinutes({
            duration_minutes: structured?.duration_minutes,
            title: item.title,
            notes: item.notes,
          }),
          priority: item.priority,
          suggested_client_name: item.suggested_client_name,
          suggested_project_name: item.suggested_project_name,
          client: suggestionPayload(clientMatch, client.id),
          project: suggestionPayload(projectMatch, project.id),
          client_id: client.id,
          project_id: project.id,
          subtasks: item.subtasks.map((subtask, subIndex) => ({
            ...subtask,
            duration_minutes: resolveMcpCreateDurationMinutes({
              duration_minutes:
                structured?.subtasks?.[subIndex]?.duration_minutes,
              title: subtask.title,
              notes: subtask.notes,
            }),
          })),
        };
      });

      if (input.mode === 'dry_run') {
        return toolJson({
          mode: 'dry_run',
          proposed,
          created: [],
          hint: 'Review the proposed list. Call extract_tasks again with mode=commit (same text or the tasks array) to create. High-confidence name matches and provided ids will be linked.',
        });
      }

      const created: Array<Record<string, unknown>> = [];

      for (const item of proposed) {
        const result = await createTaskForUser(supabase, userId, {
          title: item.title,
          notes: item.notes,
          dueDate: item.due_date ?? undefined,
          durationMinutes: item.duration_minutes,
          priority: item.priority,
          clientId: item.client_id ?? undefined,
          projectId: item.project_id ?? undefined,
          accountId: input.account_id,
          source: 'mcp',
        });

        if (!result.success) {
          throw new Error(result.error);
        }

        const createdSubtasks: Array<{
          id: string;
          title: string;
          duration_minutes: number;
        }> = [];

        for (const subtask of item.subtasks) {
          const child = await createTaskForUser(supabase, userId, {
            title: subtask.title,
            notes: subtask.notes,
            dueDate: subtask.due_date ?? undefined,
            durationMinutes: subtask.duration_minutes,
            priority: subtask.priority,
            parentTaskId: result.id,
            parentTaskContext: {
              projectId: item.project_id,
              clientId: item.client_id,
              accountId: input.account_id ?? null,
            },
            source: 'mcp',
          });

          if (!child.success) {
            throw new Error(child.error);
          }

          createdSubtasks.push({
            id: child.id,
            title: subtask.title,
            duration_minutes: subtask.duration_minutes,
          });
        }

        const { data, error } = await supabase
          .from('tasks')
          .select(
            'id, title, status, priority, due_date, duration_minutes, project_id, client_id, account_id, parent_task_id',
          )
          .eq('id', result.id)
          .maybeSingle();

        assertSupabaseOk(data, error, 'load extracted task');

        created.push({
          ...(data as Record<string, unknown>),
          client: item.client,
          project: item.project,
          subtasks: createdSubtasks,
        });
      }

      const extras = await loadLinkedNames(
        supabase,
        created as Array<{
          id: string;
          project_id?: string | null;
          client_id?: string | null;
          account_id?: string | null;
        }>,
        workspaces,
      );

      return toolJson({
        mode: 'commit',
        proposed,
        created: created.map((row) => ({
          ...row,
          ...(extras.get(String((row as { id?: string }).id)) ?? {}),
        })),
        hint: `Created ${created.length} root task(s).`,
      });
    },
  );
};
