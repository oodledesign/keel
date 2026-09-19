import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { MEMORY_NOTE_CATEGORY } from '~/home/[account]/memories/_lib/memory-constants';
import {
  MEMORY_MEDIA_MAX_BYTES,
  MemoryMediaError,
  assertMemoryMedia,
  formFileMeta,
  memoryMediaStoragePath,
  memoryMediaTags,
  normalizeMemoryMimeType,
} from '~/home/[account]/memories/_lib/memory-media';
import { assembleFamilyMemoriesPage } from '~/home/[account]/memories/_lib/server/family-memories.loader';
import { createFamilyMemoriesService } from '~/home/[account]/memories/_lib/server/family-memories.service';
import { requireUploadedMemoryObject } from '~/home/[account]/memories/_lib/server/memory-media-storage';
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

function memoryMediaHttpError(error: unknown): never {
  if (error instanceof MemoryMediaError) {
    throw new NativeHttpError(400, error.message);
  }
  throw error;
}

async function requireMemoryNote(
  client: SupabaseClient,
  workspaceId: string,
  noteId: string,
) {
  const existing = await client
    .from('notes')
    .select('id, category')
    .eq('id', noteId)
    .eq('account_id', workspaceId)
    .maybeSingle();
  const memory = existing.data as { id: string; category: string } | null;
  if (existing.error || !memory || memory.category !== MEMORY_NOTE_CATEGORY) {
    throw new NativeHttpError(404, 'Memory not found');
  }

  return memory;
}

async function registerMemoryMediaDoc(input: {
  client: SupabaseClient;
  userId: string;
  workspaceId: string;
  noteId: string;
  title: string;
  filePath: string;
  mimeType: string;
  size: number;
  kind: 'image' | 'video' | 'audio';
}) {
  const { data, error } = await input.client
    .from('docs')
    .insert({
      account_id: input.workspaceId,
      title: input.title,
      kind: 'uploaded',
      doc_type: 'general',
      category: 'idea',
      tags: memoryMediaTags(input.kind),
      storage_bucket: ACCOUNT_DOCS_BUCKET,
      file_path: input.filePath,
      storage_path: input.filePath,
      mime_type: input.mimeType,
      file_size_bytes: input.size,
      file_url: null,
      user_id: input.userId,
      created_by: input.userId,
      note_id: input.noteId,
      photo_role: 'archive',
    } as never)
    .select('id, title, mime_type')
    .single();

  if (error || !data) {
    throw new NativeHttpError(400, error?.message || 'Could not attach media');
  }

  return data as { id: string; title: string; mime_type: string | null };
}

export async function uploadNativeMemoryPhoto(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  noteId: string;
  bytes: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
  title?: string;
}) {
  return uploadNativeMemoryMedia(input);
}

export async function uploadNativeMemoryMedia(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  noteId: string;
  bytes: Buffer | Uint8Array;
  filename: string;
  mimeType: string;
  title?: string;
}) {
  requireFamilyMemoriesWorkspace(input.workspace);
  await requireMemoryNote(input.client, input.workspace.id, input.noteId);

  const mime = normalizeMemoryMimeType(input.mimeType, input.filename);
  let kind: 'image' | 'video' | 'audio';
  try {
    kind = assertMemoryMedia({
      mimeType: mime,
      filename: input.filename,
      size: input.bytes.byteLength,
    });
  } catch (error) {
    memoryMediaHttpError(error);
  }

  const filePath = memoryMediaStoragePath(input.workspace.id, input.filename);
  const admin = getSupabaseServerAdminClient();
  const body =
    input.bytes instanceof Uint8Array
      ? input.bytes
      : new Uint8Array(input.bytes);
  const { error: uploadError } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .upload(filePath, body, {
      contentType: mime || 'application/octet-stream',
      upsert: false,
    });
  if (uploadError) {
    throw new NativeHttpError(400, uploadError.message);
  }

  const title =
    input.title?.trim() || input.filename || defaultMemoryMediaTitle(kind);

  try {
    const row = await registerMemoryMediaDoc({
      client: input.client,
      userId: input.userId,
      workspaceId: input.workspace.id,
      noteId: input.noteId,
      title,
      filePath,
      mimeType: mime,
      size: input.bytes.byteLength,
      kind,
    });

    const signed = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .createSignedUrl(filePath, 3600);

    return {
      id: row.id,
      title: row.title,
      mime_type: row.mime_type,
      url: signed.data?.signedUrl ?? null,
      kind,
    };
  } catch (error) {
    await admin.storage.from(ACCOUNT_DOCS_BUCKET).remove([filePath]);
    throw error;
  }
}

export async function prepareNativeMemoryMediaUpload(input: {
  client: SupabaseClient;
  workspace: NativeWorkspace;
  noteId: string;
  filename: string;
  mimeType: string;
  size: number;
}) {
  requireFamilyMemoriesWorkspace(input.workspace);
  await requireMemoryNote(input.client, input.workspace.id, input.noteId);

  const mime = normalizeMemoryMimeType(input.mimeType, input.filename);
  try {
    assertMemoryMedia({
      mimeType: mime,
      filename: input.filename,
      size: input.size,
    });
  } catch (error) {
    memoryMediaHttpError(error);
  }

  const path = memoryMediaStoragePath(input.workspace.id, input.filename);
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .createSignedUploadUrl(path);

  if (error || !data?.token || !data.signedUrl) {
    throw new NativeHttpError(
      400,
      error?.message || 'Could not prepare the upload',
    );
  }

  return {
    bucket: ACCOUNT_DOCS_BUCKET,
    path,
    token: data.token,
    signed_url: data.signedUrl,
    mime_type: mime,
    max_bytes: MEMORY_MEDIA_MAX_BYTES,
  };
}

export async function completeNativeMemoryMediaUpload(input: {
  client: SupabaseClient;
  userId: string;
  workspace: NativeWorkspace;
  noteId: string;
  path: string;
  filename: string;
  mimeType: string;
  title?: string;
  size: number;
}) {
  requireFamilyMemoriesWorkspace(input.workspace);
  await requireMemoryNote(input.client, input.workspace.id, input.noteId);

  if (!input.path.startsWith(`${input.workspace.id}/memories/`)) {
    throw new NativeHttpError(400, 'Invalid memory storage path');
  }

  const mime = normalizeMemoryMimeType(input.mimeType, input.filename);
  let kind: 'image' | 'video' | 'audio';
  try {
    kind = assertMemoryMedia({
      mimeType: mime,
      filename: input.filename,
      size: input.size,
    });
  } catch (error) {
    memoryMediaHttpError(error);
  }

  try {
    await requireUploadedMemoryObject(input.path);
  } catch (error) {
    throw new NativeHttpError(
      400,
      error instanceof Error
        ? error.message
        : 'Upload did not finish. Try again.',
    );
  }

  const admin = getSupabaseServerAdminClient();

  const title =
    input.title?.trim() || input.filename || defaultMemoryMediaTitle(kind);
  const row = await registerMemoryMediaDoc({
    client: input.client,
    userId: input.userId,
    workspaceId: input.workspace.id,
    noteId: input.noteId,
    title,
    filePath: input.path,
    mimeType: mime,
    size: input.size,
    kind,
  });

  const signed = await admin.storage
    .from(ACCOUNT_DOCS_BUCKET)
    .createSignedUrl(input.path, 3600);

  return {
    id: row.id,
    title: row.title,
    mime_type: row.mime_type,
    url: signed.data?.signedUrl ?? null,
    kind,
  };
}

export function parseNativeMemoryFormFile(file: Blob) {
  const meta = formFileMeta(file);

  try {
    assertMemoryMedia({
      mimeType: meta.mimeType,
      filename: meta.filename,
      size: meta.size || file.size,
    });
  } catch (error) {
    memoryMediaHttpError(error);
  }

  return meta;
}

function defaultMemoryMediaTitle(kind: 'image' | 'video' | 'audio') {
  if (kind === 'audio') return 'Voice note';
  if (kind === 'video') return 'Memory video';
  return 'Memory photo';
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
