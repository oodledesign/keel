'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';
import { createTaskForUser } from '@kit/tasks/create-task';

import pathsConfig from '~/config/paths.config';
import { loadTaskAssignmentOptionsForWorkspace } from '~/home/(user)/_lib/actions/task-actions';
import { suggestTaskCsvColumnMapping } from '~/lib/ai/task-csv-map';
import { mapNameToId } from '~/lib/clients/client-import';
import { parseUkDate } from '~/lib/csv/parse-date';
import {
  type CsvFieldMapping,
  applyCsvColumnMapping,
} from '~/lib/csv/rows-to-records';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

const mappingSchema = z.record(z.string(), z.string());

const suggestSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  sampleRows: z.array(z.array(z.string())).max(10),
});

const previewSchema = z.object({
  accountId: z.string().uuid(),
  headers: z.array(z.string()).min(1).max(100),
  rows: z.array(z.array(z.string())).max(5000),
  mapping: mappingSchema,
});

const commitSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  tasks: z
    .array(
      z.object({
        title: z.string().min(1),
        notes: z.string().nullable().optional(),
        dueDate: z.string().nullable().optional(),
        priority: z.string().optional(),
        status: z.string().optional(),
        clientId: z.string().uuid().nullable().optional(),
        projectId: z.string().uuid().nullable().optional(),
      }),
    )
    .min(1)
    .max(5000),
});

async function assertWorkspaceMember(accountId: string, userId: string) {
  const client = getSupabaseServerClient();
  const { data, error } = await client
    .from('accounts_memberships')
    .select('account_id')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) throw new Error('You are not a member of this workspace');
}

function emptyToNull(value: string | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

export type TaskImportDraft = {
  rowIndex: number;
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: string;
  status: string;
  clientName: string | null;
  projectName: string | null;
  clientId: string | null;
  projectId: string | null;
  errors: string[];
  warnings: string[];
};

export const suggestTaskImportMappingAction = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);
    return suggestTaskCsvColumnMapping({
      headers: input.headers,
      sampleRows: input.sampleRows,
    });
  },
  { schema: suggestSchema },
);

export const previewTaskImportAction = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);

    const options = await loadTaskAssignmentOptionsForWorkspace(
      input.accountId,
    );
    const clients = options
      .filter((o) => o.type === 'client')
      .map((c) => ({ id: c.id, name: c.name }));
    const projects = options
      .filter((o) => o.type === 'project')
      .map((p) => ({ id: p.id, name: p.name }));

    const records = applyCsvColumnMapping(
      input.headers,
      input.rows,
      input.mapping as CsvFieldMapping,
    );

    const drafts: TaskImportDraft[] = records.map((record, rowIndex) => {
      const title = emptyToNull(record.title) ?? '';
      const clientName = emptyToNull(record.client_name);
      const projectName = emptyToNull(record.project_name);
      const dueRaw = emptyToNull(record.due_date);
      const dueDate = dueRaw ? parseUkDate(dueRaw) : null;
      const errors: string[] = [];
      const warnings: string[] = [];

      if (!title) errors.push('Title is required');
      if (dueRaw && !dueDate) warnings.push('Could not parse due date');

      const clientId = mapNameToId(clientName, clients);
      const projectId = mapNameToId(projectName, projects);
      if (clientName && !clientId) {
        warnings.push(`No matching client for "${clientName}"`);
      }
      if (projectName && !projectId) {
        warnings.push(`No matching project for "${projectName}"`);
      }

      return {
        rowIndex,
        title,
        notes: emptyToNull(record.notes),
        dueDate,
        priority: emptyToNull(record.priority) ?? 'medium',
        status: emptyToNull(record.status) ?? 'todo',
        clientName,
        projectName,
        clientId,
        projectId,
        errors,
        warnings,
      };
    });

    return {
      drafts,
      validCount: drafts.filter((d) => d.errors.length === 0).length,
      errorCount: drafts.filter((d) => d.errors.length > 0).length,
    };
  },
  { schema: previewSchema },
);

export const commitTaskImportAction = enhanceAction(
  async (input, user) => {
    await assertWorkspaceMember(input.accountId, user.id);
    const client = getSupabaseServerClient();
    await requireUserInServerComponent();

    let imported = 0;
    const failed: Array<{ rowIndex: number; error: string }> = [];

    for (let i = 0; i < input.tasks.length; i++) {
      const task = input.tasks[i]!;
      try {
        const result = await createTaskForUser(client, user.id, {
          title: task.title,
          notes: task.notes ?? null,
          dueDate: task.dueDate ?? undefined,
          priority: task.priority as 'low' | 'medium' | 'high' | 'urgent',
          status: task.status as
            | 'todo'
            | 'in_progress'
            | 'client_review'
            | 'done'
            | 'cancelled',
          clientId: task.clientId ?? undefined,
          projectId: task.projectId ?? undefined,
          accountId: input.accountId,
          source: 'csv_import',
        });

        if (!result.success) {
          failed.push({
            rowIndex: i,
            error: result.error || 'Failed to create task',
          });
          continue;
        }
        imported += 1;
      } catch (error) {
        failed.push({
          rowIndex: i,
          error:
            error instanceof Error ? error.message : 'Failed to create task',
        });
      }
    }

    const tasksPath = pathsConfig.app.accountTasks.replace(
      '[account]',
      input.accountSlug,
    );
    revalidatePath(tasksPath, 'page');
    revalidatePath(`/home/${input.accountSlug}/tasks`, 'page');

    return { imported, failed };
  },
  { schema: commitSchema },
);
