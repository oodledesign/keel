import { z } from 'zod';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { OzerMcpToolRegistrar } from './types';
import {
  assertAccountAccess,
  assertClientOrgAccess,
  assertSupabaseOk,
  loadUserAccountIds,
  toolJson,
} from './shared';

const createNoteSchema = z.object({
  content: z.string().trim().min(1),
  project_id: z.string().uuid().optional(),
  client_org_id: z.string().uuid().optional(),
});

const listNotesSchema = z.object({
  project_id: z.string().uuid().optional(),
  client_org_id: z.string().uuid().optional(),
  limit: z.number().int().min(1).max(100).optional().default(20),
});

type NoteRow = {
  id: string;
  content: string | null;
  title?: string | null;
  project_id?: string | null;
  client_org_id?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function mapNote(row: NoteRow) {
  return {
    id: row.id,
    content: row.content,
    title: row.title ?? '',
    project_id: row.project_id ?? null,
    client_org_id: row.client_org_id ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  };
}

async function resolveNoteAccountId(
  supabase: SupabaseClient,
  userId: string,
  input: { project_id?: string; client_org_id?: string },
): Promise<string> {
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

    await assertAccountAccess(supabase, userId, accountId);
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

  const accountIds = await loadUserAccountIds(supabase, userId);
  const accountId = accountIds[0];
  if (!accountId) {
    throw new Error('No workspace account available for note');
  }

  return accountId;
}

export const registerNoteTools: OzerMcpToolRegistrar = (server, context) => {
  const { supabase, userId } = context;

  server.registerTool(
    'create_note',
    {
      description: 'Create a note for the authenticated user.',
      inputSchema: createNoteSchema,
    },
    async (input) => {
      const accountId = await resolveNoteAccountId(supabase, userId, input);

      const insertRow: Record<string, unknown> = {
        account_id: accountId,
        content: input.content,
        title: '',
        user_id: userId,
        created_by: userId,
        project_id: input.project_id ?? null,
        client_org_id: input.client_org_id ?? null,
        source: 'mcp',
      };

      let result = await supabase
        .from('notes')
        .insert(insertRow)
        .select(
          'id, content, title, project_id, client_org_id, created_at, updated_at',
        )
        .single();

      if (result.error?.message?.includes('source')) {
        const { source: _source, ...withoutSource } = insertRow;
        void _source;
        result = await supabase
          .from('notes')
          .insert(withoutSource)
          .select(
            'id, content, title, project_id, client_org_id, created_at, updated_at',
          )
          .single();
      }

      assertSupabaseOk(result.data, result.error, 'create note');
      return toolJson({ note: mapNote(result.data as NoteRow) });
    },
  );

  server.registerTool(
    'list_notes',
    {
      description: 'List notes owned by the authenticated user.',
      inputSchema: listNotesSchema,
    },
    async (input) => {
      let query = supabase
        .from('notes')
        .select(
          'id, content, title, project_id, client_org_id, created_at, updated_at',
        )
        .eq('user_id', userId)
        .order('updated_at', { ascending: false })
        .limit(input.limit);

      if (input.project_id) {
        query = query.eq('project_id', input.project_id);
      }
      if (input.client_org_id) {
        query = query.eq('client_org_id', input.client_org_id);
      }

      const { data, error } = await query;
      assertSupabaseOk(data, error, 'list notes');

      return toolJson({ notes: (data ?? []).map(mapNote) });
    },
  );
};
