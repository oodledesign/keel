'use server';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';

import { loadAccountDocs } from './docs-loader';
import { loadAccountNotes } from './notes-loader';
import type { NoteFileCategory } from './types';
import { NOTE_FILE_CATEGORY_LABELS } from './types';

export type NotesFilesListItem = {
  id: string;
  type: 'note' | 'file';
  title: string;
  category: NoteFileCategory;
  categoryLabel: string;
  preview: string;
  kind?: 'written' | 'uploaded';
  updatedAt: string;
};

export const listNotesAndFilesForContextAction = enhanceAction(
  async (data) => {
    const { getSupabaseServerClient } = await import('@kit/supabase/server-client');
    const client = getSupabaseServerClient();

    let clientOrgId = data.clientId ?? data.clientOrgId ?? null;
    if (data.dealId && !clientOrgId) {
      const { data: deal } = await client
        .from('pipeline_deals')
        .select('client_id')
        .eq('id', data.dealId)
        .eq('account_id', data.accountId)
        .maybeSingle();
      clientOrgId = (deal?.client_id as string | null) ?? null;
    }

    const scope = clientOrgId
      ? { clientOrgId }
      : data.projectId
        ? { projectId: data.projectId }
        : undefined;

    const [notesResult, docsResult] = await Promise.all([
      loadAccountNotes(data.accountId, scope),
      loadAccountDocs(data.accountId, scope),
    ]);

    const items: NotesFilesListItem[] = [
      ...notesResult.notes.map((n) => ({
        id: n.id,
        type: 'note' as const,
        title: n.title,
        category: n.category,
        categoryLabel: NOTE_FILE_CATEGORY_LABELS[n.category],
        preview: n.content.slice(0, 200),
        updatedAt: n.updatedAt,
      })),
      ...docsResult.docs.map((d) => ({
        id: d.id,
        type: 'file' as const,
        title: d.title,
        category: d.category,
        categoryLabel: NOTE_FILE_CATEGORY_LABELS[d.category],
        preview:
          d.kind === 'uploaded'
            ? `${d.mimeType ?? 'file'} · uploaded`
            : (d.content ?? '').slice(0, 200),
        kind: d.kind,
        updatedAt: d.updatedAt,
      })),
    ].sort(
      (a, b) =>
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
    );

    return { items };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      clientId: z.string().uuid().optional(),
      clientOrgId: z.string().uuid().optional(),
      dealId: z.string().uuid().optional(),
      projectId: z.string().uuid().optional(),
    }),
  },
);

export const loadNotesAndFilesContentAction = enhanceAction(
  async (data) => {
    const client = await import('@kit/supabase/server-client').then((m) =>
      m.getSupabaseServerClient(),
    );

    const items: { type: 'note' | 'file'; title: string; content: string }[] =
      [];

    for (const ref of data.refs) {
      if (ref.type === 'note') {
        const { data: note, error } = await client
          .from('notes')
          .select('title, content')
          .eq('id', ref.id)
          .eq('account_id', data.accountId)
          .maybeSingle();
        if (error) throw error;
        if (note) {
          items.push({
            type: 'note',
            title: (note.title as string) || 'Note',
            content: (note.content as string) ?? '',
          });
        }
      } else {
        const { data: doc, error } = await client
          .from('docs')
          .select('title, content, kind, mime_type')
          .eq('id', ref.id)
          .eq('account_id', data.accountId)
          .maybeSingle();
        if (error) throw error;
        if (doc) {
          const content =
            doc.kind === 'written'
              ? ((doc.content as string) ?? '')
              : `[Uploaded file: ${(doc.mime_type as string) ?? 'file'}]`;
          items.push({
            type: 'file',
            title: (doc.title as string) || 'File',
            content,
          });
        }
      }
    }

    return { items };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      refs: z.array(
        z.object({
          type: z.enum(['note', 'file']),
          id: z.string().uuid(),
          title: z.string().optional(),
        }),
      ),
    }),
  },
);
