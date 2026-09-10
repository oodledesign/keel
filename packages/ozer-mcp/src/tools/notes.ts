import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import { requireWorkspaceAccess } from './lookup';
import {
  assertClientOrgAccess,
  assertSupabaseOk,
  loadUserWorkspaces,
  pickDefined,
  toolJson,
} from './shared';
import type { OzerMcpToolRegistrar } from './types';

const createNoteSchema = z.object({
  content: z.string().trim().min(1),
  title: z.string().trim().optional(),
  account_id: z
    .string()
    .uuid()
    .optional()
    .describe('Workspace for the note. Required unless a link implies it.'),
  project_id: z.string().uuid().optional(),
  client_id: z
    .string()
    .uuid()
    .optional()
    .describe('CRM client id. Prefer this over client_org_id.'),
  task_id: z.string().uuid().optional(),
  client_org_id: z.string().uuid().optional(),
  meeting_transcript_id: z
    .string()
    .uuid()
    .optional()
    .describe('Set when the notes table has a meeting transcript FK.'),
});

const updateNoteSchema = z.object({
  id: z.string().uuid(),
  title: z.string().trim().nullable().optional(),
  content: z.string().trim().min(1).optional(),
  project_id: z.string().uuid().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
  task_id: z.string().uuid().nullable().optional(),
  client_org_id: z.string().uuid().nullable().optional(),
});

const getNoteSchema = z.object({
  id: z.string().uuid(),
});

const listNotesSchema = z.object({
  account_id: z.string().uuid().optional(),
  project_id: z.string().uuid().optional(),
  client_id: z.string().uuid().optional(),
  task_id: z.string().uuid().optional(),
  client_org_id: z.string().uuid().optional(),
  q: z.string().trim().min(1).max(200).optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

type NoteRow = {
  id: string;
  content: string | null;
  title?: string | null;
  project_id?: string | null;
  client_id?: string | null;
  task_id?: string | null;
  client_org_id?: string | null;
  meeting_transcript_id?: string | null;
  account_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

const NOTE_SELECT =
  'id, content, title, project_id, client_id, task_id, client_org_id, account_id, created_at, updated_at';

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    title: row.title ?? '',
    content: row.content,
    project_id: row.project_id ?? null,
    client_id: row.client_id ?? null,
    task_id: row.task_id ?? null,
    client_org_id: row.client_org_id ?? null,
    meeting_transcript_id: row.meeting_transcript_id ?? null,
    account_id: row.account_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function resolveNoteAccountId(
  supabase: SupabaseClient,
  userId: string,
  input: {
    account_id?: string;
    project_id?: string;
    client_id?: string;
    client_org_id?: string;
    task_id?: string;
  },
): Promise<string> {
  if (input.account_id) {
    await requireWorkspaceAccess(supabase, userId, input.account_id);
    return input.account_id;
  }

  if (input.project_id) {
    const { data, error } = await supabase
      .from('projects')
      .select('account_id')
      .eq('id', input.project_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve project for note');

    const accountId = (data as { account_id?: string | null } | null)
      ?.account_id;
    if (!accountId) {
      throw new Error('Project not found');
    }

    await requireWorkspaceAccess(supabase, userId, accountId);
    return accountId;
  }

  if (input.client_id) {
    const { data, error } = await supabase
      .from('clients')
      .select('account_id')
      .eq('id', input.client_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve client for note');

    const accountId = (data as { account_id?: string | null } | null)
      ?.account_id;
    if (!accountId) {
      throw new Error('Client not found');
    }

    await requireWorkspaceAccess(supabase, userId, accountId);
    return accountId;
  }

  if (input.task_id) {
    const { data, error } = await supabase
      .from('tasks')
      .select('account_id')
      .eq('id', input.task_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve task for note');

    const accountId = (data as { account_id?: string | null } | null)
      ?.account_id;
    if (!accountId) {
      throw new Error('Task has no associated workspace');
    }

    await requireWorkspaceAccess(supabase, userId, accountId);
    return accountId;
  }

  if (input.client_org_id) {
    await assertClientOrgAccess(supabase, userId, input.client_org_id);

    const { data, error } = await supabase
      .from('client_orgs')
      .select('business_id')
      .eq('id', input.client_org_id)
      .maybeSingle();

    assertSupabaseOk(data, error, 'resolve client org for note');

    const accountId = (data as { business_id?: string | null } | null)
      ?.business_id;
    if (!accountId) {
      throw new Error('Client org not found');
    }

    return accountId;
  }

  throw new Error(
    'Provide account_id from list_workspaces, or link the note to a task, client, or project',
  );
}

async function loadNoteRow(
  supabase: SupabaseClient,
  id: string,
): Promise<NoteRow> {
  const { data, error } = await supabase
    .from('notes')
    .select(NOTE_SELECT)
    .eq('id', id)
    .maybeSingle();

  assertSupabaseOk(data, error, 'get note');

  if (!data) {
    throw new Error('Note not found');
  }

  return data as NoteRow;
}

async function insertNote(
  supabase: SupabaseClient,
  insertRow: Record<string, unknown>,
) {
  const select = `${NOTE_SELECT}`;
  let result = await supabase
    .from('notes')
    .insert(insertRow)
    .select(select)
    .single();

  if (
    result.error &&
    /column .* does not exist|schema cache/i.test(result.error.message) &&
    /source|meeting_transcript_id/i.test(result.error.message)
  ) {
    const retry = { ...insertRow };
    if (result.error.message.includes('source')) {
      delete retry.source;
    }
    if (result.error.message.includes('meeting_transcript_id')) {
      delete retry.meeting_transcript_id;
    }
    result = await supabase.from('notes').insert(retry).select(select).single();
  }

  assertSupabaseOk(result.data, result.error, 'create note');
  return result.data as NoteRow;
}

export const registerNoteTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'create_note',
    {
      description:
        'Create a workspace note. Link to a task, CRM client, project, or meeting transcript when those ids are known. Prefer account_id from list_workspaces when the note is not linked. Cannot delete notes.',
      inputSchema: createNoteSchema,
    },
    async (input) => {
      const accountId = await resolveNoteAccountId(supabase, userId, input);

      const insertRow: Record<string, unknown> = {
        account_id: accountId,
        content: input.content,
        title: input.title?.trim() || '',
        user_id: userId,
        created_by: userId,
        project_id: input.project_id ?? null,
        client_id: input.client_id ?? null,
        task_id: input.task_id ?? null,
        client_org_id: input.client_org_id ?? null,
        source: 'mcp',
      };

      if (input.meeting_transcript_id) {
        insertRow.meeting_transcript_id = input.meeting_transcript_id;
      }

      return toolJson({ note: mapNote(await insertNote(supabase, insertRow)) });
    },
  );

  server.registerTool(
    'update_note',
    {
      description:
        'Patch a note the user can access: title, content, or links (task_id, client_id, project_id). Only provided fields change. Cannot delete notes.',
      inputSchema: updateNoteSchema,
    },
    async (input) => {
      const updates = pickDefined({
        title: input.title === undefined ? undefined : (input.title ?? ''),
        content: input.content,
        project_id: input.project_id,
        client_id: input.client_id,
        task_id: input.task_id,
        client_org_id: input.client_org_id,
      });

      if (Object.keys(updates).length === 0) {
        throw new Error('Provide at least one field to update');
      }

      const existing = await loadNoteRow(supabase, input.id);
      if (!existing.account_id) {
        throw new Error('Note not found');
      }

      await requireWorkspaceAccess(supabase, userId, existing.account_id);

      const { data, error } = await supabase
        .from('notes')
        .update(updates)
        .eq('id', input.id)
        .eq('account_id', existing.account_id)
        .select(NOTE_SELECT)
        .maybeSingle();

      assertSupabaseOk(data, error, 'update note');

      if (!data) {
        throw new Error('Note not found');
      }

      return toolJson({ note: mapNote(data as NoteRow) });
    },
  );

  server.registerTool(
    'get_note',
    {
      description: 'Fetch one note by id.',
      inputSchema: getNoteSchema,
    },
    async (input) => {
      const note = await loadNoteRow(supabase, input.id);
      if (!note.account_id) {
        throw new Error('Note not found');
      }

      await requireWorkspaceAccess(supabase, userId, note.account_id);
      return toolJson({ note: mapNote(note) });
    },
  );

  server.registerTool(
    'list_notes',
    {
      description:
        'List recent notes the user can access. Optional account_id, task_id, client_id, project_id, or q (title/content). Do not pass a client filter unless the user names one.',
      inputSchema: listNotesSchema,
    },
    async (input) => {
      const workspaces = await loadUserWorkspaces(supabase, userId);
      const accountIds = input.account_id
        ? workspaces.some((workspace) => workspace.id === input.account_id)
          ? [input.account_id]
          : []
        : workspaces.map((workspace) => workspace.id);

      if (accountIds.length === 0) {
        return toolJson({ notes: [] });
      }

      let query = supabase
        .from('notes')
        .select(NOTE_SELECT)
        .in('account_id', accountIds)
        .order('updated_at', { ascending: false })
        .limit(input.q ? 100 : input.limit);

      if (input.project_id) {
        query = query.eq('project_id', input.project_id);
      }
      if (input.client_id) {
        query = query.eq('client_id', input.client_id);
      }
      if (input.task_id) {
        query = query.eq('task_id', input.task_id);
      }
      if (input.client_org_id) {
        query = query.eq('client_org_id', input.client_org_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list notes');

      const needle = input.q?.trim().toLowerCase();
      const notes = ((data ?? []) as NoteRow[])
        .filter((row) => {
          if (!needle) {
            return true;
          }

          return `${row.title ?? ''} ${row.content ?? ''}`
            .toLowerCase()
            .includes(needle);
        })
        .slice(0, input.limit);

      return toolJson({
        notes: notes.map(mapNote),
      });
    },
  );
};
