'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import { queueBrainIndexSource } from '~/lib/brain/sync';

import { ACCOUNT_DOCS_BUCKET } from './docs-constants';
import { DOC_TYPE_OPTIONS, NOTE_FILE_CATEGORY_OPTIONS } from './types';

const LinkSchema = z
  .object({
    type: z.enum(['project', 'job', 'client', 'property', 'task']),
    id: z.string().uuid(),
  })
  .nullable()
  .optional();

function linkToColumns(link: z.infer<typeof LinkSchema>) {
  const cols = {
    project_id: null as string | null,
    job_id: null as string | null,
    client_id: null as string | null,
    client_org_id: null as string | null,
    property_id: null as string | null,
    task_id: null as string | null,
  };
  if (!link) return cols;
  switch (link.type) {
    case 'project':
      cols.project_id = link.id;
      break;
    case 'job':
      cols.job_id = link.id;
      break;
    case 'client':
      cols.client_id = link.id;
      cols.client_org_id = link.id;
      break;
    case 'property':
      cols.property_id = link.id;
      break;
    case 'task':
      cols.task_id = link.id;
      break;
  }
  return cols;
}

const SaveWrittenDocSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  docId: z.string().uuid().optional(),
  title: z.string().max(500),
  content: z.string().optional(),
  docType: z.enum(DOC_TYPE_OPTIONS).nullable().optional(),
  category: z.enum(NOTE_FILE_CATEGORY_OPTIONS).optional(),
  tags: z.array(z.string()).optional(),
  link: LinkSchema,
});

export const saveWrittenWorkspaceDocAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const linkCols = linkToColumns(data.link);
    const tags = (data.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const payload = {
      account_id: data.accountId,
      title: data.title.trim() || 'Untitled document',
      // Content MUST be a Markdown string — see lib/markdown.ts contract.
      content: data.content ?? '',
      kind: 'written' as const,
      doc_type: data.docType ?? 'general',
      category: data.category ?? 'idea',
      tags,
      user_id: user.id,
      ...linkCols,
    };

    if (data.docId) {
      const { error } = await client
        .from('docs')
        .update(payload)
        .eq('id', data.docId)
        .eq('account_id', data.accountId);
      if (error) throw error;
      queueBrainIndexSource(data.accountId, 'doc', data.docId);
      revalidateDocsPaths(data.accountSlug, data.docId);
      return { docId: data.docId };
    }

    const { data: inserted, error } = await client
      .from('docs')
      .insert({ ...payload, created_by: user.id })
      .select('id')
      .single();

    if (error) throw error;
    const docId = inserted.id as string;
    queueBrainIndexSource(data.accountId, 'doc', docId);
    revalidateDocsPaths(data.accountSlug, docId);
    return { docId };
  },
  { schema: SaveWrittenDocSchema },
);

const RegisterUploadSchema = z.object({
  accountId: z.string().uuid(),
  accountSlug: z.string().min(1),
  title: z.string().max(500),
  docType: z.enum(DOC_TYPE_OPTIONS).nullable().optional(),
  category: z.enum(NOTE_FILE_CATEGORY_OPTIONS).optional(),
  tags: z.array(z.string()).optional(),
  link: LinkSchema,
  filePath: z.string().min(1),
  mimeType: z.string().nullable().optional(),
  fileSizeBytes: z.number().int().nonnegative().optional(),
});

export const registerUploadedWorkspaceDocAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const admin = getSupabaseServerAdminClient();
    const linkCols = linkToColumns(data.link);
    const tags = (data.tags ?? []).map((t) => t.trim()).filter(Boolean);

    const { data: urlData } = admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .getPublicUrl(data.filePath);

    const { data: inserted, error } = await client
      .from('docs')
      .insert({
        account_id: data.accountId,
        title: data.title.trim() || 'Uploaded file',
        kind: 'uploaded',
        doc_type: data.docType ?? 'general',
        category: data.category ?? 'idea',
        tags,
        file_path: data.filePath,
        storage_path: data.filePath,
        mime_type: data.mimeType ?? null,
        file_size_bytes: data.fileSizeBytes ?? null,
        file_url: urlData?.publicUrl ?? null,
        user_id: user.id,
        created_by: user.id,
        ...linkCols,
      })
      .select('id')
      .single();

    if (error) throw error;
    const docId = inserted.id as string;
    revalidateDocsPaths(data.accountSlug, docId);
    return { docId };
  },
  { schema: RegisterUploadSchema },
);

export const getWorkspaceDocDownloadUrlAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: doc, error } = await client
      .from('docs')
      .select('file_path, storage_path, file_url, kind')
      .eq('id', data.docId)
      .eq('account_id', data.accountId)
      .maybeSingle();

    if (error) throw error;
    if (!doc || doc.kind !== 'uploaded') {
      return { url: null };
    }

    if (doc.file_url) {
      return { url: doc.file_url as string };
    }

    const path =
      (doc.file_path as string | null) ?? (doc.storage_path as string | null);
    if (!path) return { url: null };

    const admin = getSupabaseServerAdminClient();
    const { data: signed, error: signError } = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .createSignedUrl(path, 3600);

    if (signError) throw signError;
    return { url: signed?.signedUrl ?? null };
  },
  {
    schema: z.object({
      accountId: z.string().uuid(),
      docId: z.string().uuid(),
    }),
  },
);

function revalidateDocsPaths(accountSlug: string, docId?: string) {
  const base = pathsConfig.app.accountDocs.replace('[account]', accountSlug);
  revalidatePath(base);
  revalidatePath(`/home/${accountSlug}`);
  if (docId) {
    revalidatePath(
      pathsConfig.app.accountDocDetail
        .replace('[account]', accountSlug)
        .replace('[docId]', docId),
    );
  }
}
