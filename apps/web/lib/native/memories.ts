import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { MEMORY_NOTE_CATEGORY } from '~/home/[account]/memories/_lib/memory-constants';
import { assembleFamilyMemoriesPage } from '~/home/[account]/memories/_lib/server/family-memories.loader';
import { createFamilyMemoriesService } from '~/home/[account]/memories/_lib/server/family-memories.service';
import { queueBrainIndexSource } from '~/lib/brain/sync';

import { NativeHttpError } from './http';
import {
  type NativeMemoriesPayload,
  parseNativeBirthday,
  parseNativeMemoryKind,
  parseNativeOccurredOn,
  requireFamilyMemoriesWorkspace,
  toNativeMemoriesPayload,
} from './memories-shared';
import type { NativeWorkspace } from './workspace-shared';

export {
  isFamilyMemoriesWorkspace,
  requireFamilyMemoriesWorkspace,
} from './memories-shared';
export type {
  NativeMemoriesPayload,
  NativeMemoryChild,
  NativeMemoryItem,
  NativeMemoryKind,
  NativeMemoryMedia,
} from './memories-shared';

function accountSlug(workspace: NativeWorkspace) {
  return workspace.slug || workspace.id;
}

export async function listNativeMemories(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  options: {
    childId?: string | null;
    kind?: string | null;
  } = {},
): Promise<NativeMemoriesPayload> {
  requireFamilyMemoriesWorkspace(workspace);

  const data = await assembleFamilyMemoriesPage(client, {
    accountId: workspace.id,
    accountSlug: accountSlug(workspace),
    childId: options.childId || undefined,
    kind: parseNativeMemoryKind(options.kind ?? null),
  });

  return toNativeMemoriesPayload(data);
}

export async function createNativeMemory(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  title?: string | null;
  content: string;
  occurredAt?: string | null;
  kind?: string | null;
  childIds?: string[];
}) {
  requireFamilyMemoriesWorkspace(input.workspace);

  const content = input.content.trim();
  if (!content) {
    throw new NativeHttpError(400, 'Write the memory');
  }
  if (content.length > 20_000) {
    throw new NativeHttpError(400, 'Memory is too long');
  }

  const title = input.title?.trim() || '';
  if (title.length > 500) {
    throw new NativeHttpError(400, 'Title is too long');
  }

  const childIds = [...new Set(input.childIds ?? [])];
  if (childIds.length > 20) {
    throw new NativeHttpError(400, 'Too many children on this memory');
  }

  await assertPeopleInWorkspace(input.client, input.workspace.id, childIds);

  const service = createFamilyMemoriesService(input.client);
  const result = await service.saveMemory(
    {
      accountId: input.workspace.id,
      accountSlug: accountSlug(input.workspace),
      title: title || undefined,
      content,
      occurredAt: parseNativeOccurredOn(input.occurredAt),
      kind: parseNativeMemoryKind(input.kind ?? null),
      childIds,
    },
    input.userId,
  );

  queueBrainIndexSource(input.workspace.id, 'note', result.noteId);
  return { id: result.noteId };
}

export async function upsertNativeFamilyChild(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  id?: string;
  displayName: string;
  dateOfBirth?: string | null;
  isChild?: boolean;
}) {
  requireFamilyMemoriesWorkspace(input.workspace);

  const displayName = input.displayName.trim();
  if (!displayName) {
    throw new NativeHttpError(400, 'Name is required');
  }
  if (displayName.length > 80) {
    throw new NativeHttpError(400, 'Name is too long');
  }

  const service = createFamilyMemoriesService(input.client);
  return service.upsertChild({
    accountId: input.workspace.id,
    userId: input.userId,
    id: input.id,
    fullName: displayName,
    dateOfBirth: parseNativeBirthday(input.dateOfBirth),
    isChild: input.isChild ?? true,
  });
}

export async function uploadNativeMemoryPhoto(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  noteId: string;
  bytes: Buffer;
  filename: string;
  mimeType: string;
  title?: string;
}) {
  requireFamilyMemoriesWorkspace(input.workspace);

  const existing = await input.client
    .from('notes')
    .select('id, category')
    .eq('id', input.noteId)
    .eq('account_id', input.workspace.id)
    .maybeSingle();
  const memory = existing.data as { id: string; category: string } | null;
  if (existing.error || !memory || memory.category !== MEMORY_NOTE_CATEGORY) {
    throw new NativeHttpError(404, 'Memory not found');
  }

  const mime = input.mimeType || 'image/jpeg';
  if (!mime.startsWith('image/') && !mime.startsWith('video/')) {
    throw new NativeHttpError(400, 'Only photos or videos can be attached');
  }

  const safeName =
    input.filename.replace(/[^a-zA-Z0-9._-]/g, '_') || 'memory.jpg';
  const filePath = `${input.workspace.id}/memories/${Date.now()}_${safeName}`;
  const admin = getSupabaseServerAdminClient();
  const { error: uploadError } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .upload(filePath, input.bytes, {
      contentType: mime,
      upsert: false,
    });
  if (uploadError) {
    throw new NativeHttpError(400, uploadError.message);
  }

  const title = input.title?.trim() || input.filename || 'Memory photo';
  const { data, error } = await input.client
    .from('docs')
    .insert({
      account_id: input.workspace.id,
      title,
      kind: 'uploaded',
      doc_type: 'general',
      category: 'idea',
      tags: ['memory'],
      storage_bucket: ACCOUNT_DOCS_BUCKET,
      file_path: filePath,
      storage_path: filePath,
      mime_type: mime,
      file_size_bytes: input.bytes.length,
      file_url: null,
      user_id: input.userId,
      created_by: input.userId,
      note_id: input.noteId,
      photo_role: 'archive',
    } as never)
    .select('id, title, mime_type')
    .single();

  if (error || !data) {
    await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([filePath]);
    throw new NativeHttpError(400, error?.message || 'Could not attach photo');
  }

  const signed = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .createSignedUrl(filePath, 3600);

  const row = data as { id: string; title: string; mime_type: string | null };
  return {
    id: row.id,
    title: row.title,
    mime_type: row.mime_type,
    url: signed.data?.signedUrl ?? null,
  };
}

async function assertPeopleInWorkspace(
  client: SupabaseClient,
  accountId: string,
  personIds: string[],
) {
  if (personIds.length === 0) return;

  const service = createFamilyMemoriesService(client);
  const people = await service.listAccountPeople(accountId);
  const allowed = new Set(
    people.filter((person) => person.is_child).map((person) => person.id),
  );
  for (const personId of personIds) {
    if (!allowed.has(personId)) {
      throw new NativeHttpError(
        400,
        'child_ids must be children in this workspace',
      );
    }
  }
}
