'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { ACCOUNT_DOCS_BUCKET } from '~/home/[account]/_lib/workspace-content/docs-constants';
import { queueBrainIndexSource } from '~/lib/brain/sync';

import {
  assertMemoryMedia,
  memoryMediaStoragePath,
  memoryMediaTags,
  normalizeMemoryMimeType,
} from '../memory-media';
import {
  CompleteFamilyMemoryMediaSchema,
  PrepareFamilyMemoryMediaSchema,
  SaveFamilyMemorySchema,
  UpsertFamilyChildSchema,
} from '../schemas/family-memories.schema';
import { createFamilyMemoriesService } from './family-memories.service';
import { requireUploadedMemoryObject } from './memory-media-storage';

function revalidateMemoryPaths(accountSlug: string, noteId?: string) {
  revalidatePath(
    pathsConfig.app.accountMemories.replace('[account]', accountSlug),
  );
  revalidatePath(`/home/${accountSlug}/memories`);
  revalidatePath(
    pathsConfig.app.accountMemoryChildren.replace('[account]', accountSlug),
  );
  revalidatePath(
    pathsConfig.app.accountNotes.replace('[account]', accountSlug),
  );

  if (noteId) {
    revalidatePath(
      pathsConfig.app.accountNoteDetail
        .replace('[account]', accountSlug)
        .replace('[noteId]', noteId),
    );
  }
}

export const saveFamilyMemoryAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const ctx = { name: 'save-family-memory', userId: user.id };
    logger.info(ctx, 'Saving family memory');

    const client = getSupabaseServerClient();
    const service = createFamilyMemoriesService(client);
    const result = await service.saveMemory(data, user.id);

    queueBrainIndexSource(data.accountId, 'note', result.noteId);
    revalidateMemoryPaths(data.accountSlug, result.noteId);

    logger.info({ ...ctx, noteId: result.noteId }, 'Family memory saved');
    return result;
  },
  { schema: SaveFamilyMemorySchema },
);

export const prepareFamilyMemoryMediaAction = enhanceAction(
  async (data) => {
    const client = getSupabaseServerClient();
    const { data: note, error: noteError } = await client
      .from('notes')
      .select('id')
      .eq('id', data.noteId)
      .eq('account_id', data.accountId)
      .maybeSingle();
    if (noteError) throw noteError;
    if (!note) {
      throw new Error('Memory not found in this workspace');
    }

    const mime = normalizeMemoryMimeType(data.mimeType, data.filename);
    assertMemoryMedia({
      mimeType: mime,
      filename: data.filename,
      size: data.fileSizeBytes,
    });

    const filePath = memoryMediaStoragePath(data.accountId, data.filename);
    const admin = getSupabaseServerAdminClient();
    const { data: signed, error } = await admin.storage
      .from(ACCOUNT_DOCS_BUCKET)
      .createSignedUploadUrl(filePath);

    if (error || !signed?.token || !signed.signedUrl) {
      throw new Error(error?.message || 'Could not prepare the upload');
    }

    return {
      bucket: ACCOUNT_DOCS_BUCKET,
      filePath,
      token: signed.token,
      signedUrl: signed.signedUrl,
      mimeType: mime,
    };
  },
  { schema: PrepareFamilyMemoryMediaSchema },
);

export const completeFamilyMemoryMediaAction = enhanceAction(
  async (data, user) => {
    const client = getSupabaseServerClient();
    const { data: note, error: noteError } = await client
      .from('notes')
      .select('id')
      .eq('id', data.noteId)
      .eq('account_id', data.accountId)
      .maybeSingle();
    if (noteError) throw noteError;
    if (!note) {
      throw new Error('Memory not found in this workspace');
    }

    if (!data.filePath.startsWith(`${data.accountId}/memories/`)) {
      throw new Error('Invalid memory storage path');
    }

    const mime = normalizeMemoryMimeType(data.mimeType, data.filename);
    const kind = assertMemoryMedia({
      mimeType: mime,
      filename: data.filename,
      size: data.fileSizeBytes,
    });

    await requireUploadedMemoryObject(data.filePath);

    const { data: inserted, error } = await client
      .from('docs')
      .insert({
        account_id: data.accountId,
        title: data.title?.trim() || data.filename,
        kind: 'uploaded',
        doc_type: 'general',
        category: 'idea',
        tags: memoryMediaTags(kind),
        storage_bucket: ACCOUNT_DOCS_BUCKET,
        file_path: data.filePath,
        storage_path: data.filePath,
        mime_type: mime,
        file_size_bytes: data.fileSizeBytes,
        file_url: null,
        user_id: user.id,
        created_by: user.id,
        note_id: data.noteId,
        photo_role: 'archive',
      } as never)
      .select('id')
      .single();

    if (error || !inserted) {
      throw new Error(error?.message || 'Could not attach media');
    }

    revalidateMemoryPaths(data.accountSlug, data.noteId);
    return { docId: inserted.id as string, kind };
  },
  { schema: CompleteFamilyMemoryMediaSchema },
);

export const upsertFamilyChildAction = enhanceAction(
  async (data, user) => {
    const scope = await resolveMealPlanScope(data.accountSlug);
    if (scope.kind !== 'workspace') {
      throw new Error('Children belong to a family workspace');
    }

    const client = getSupabaseServerClient();
    const service = createFamilyMemoriesService(client);
    const result = await service.upsertChild({
      accountId: scope.accountId,
      userId: user.id,
      id: data.id,
      fullName: data.displayName,
      dateOfBirth: data.dateOfBirth,
      isChild: data.isChild ?? true,
    });

    revalidateMemoryPaths(data.accountSlug);
    revalidatePath('/home/people');
    revalidatePath('/app/people');
    revalidatePath(
      pathsConfig.app.accountMemoryChild
        .replace('[account]', data.accountSlug)
        .replace('[personId]', result.id),
    );

    return result;
  },
  { schema: UpsertFamilyChildSchema },
);
