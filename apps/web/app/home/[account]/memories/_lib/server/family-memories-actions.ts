'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { resolveMealPlanScope } from '~/home/(user)/life/family/_lib/server/family-meal.scope';
import { queueBrainIndexSource } from '~/lib/brain/sync';

import {
  SaveFamilyMemorySchema,
  UpsertFamilyChildSchema,
} from '../schemas/family-memories.schema';
import { createFamilyMemoriesService } from './family-memories.service';

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
  revalidatePath('/home/people');
  revalidatePath('/app/people');

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
    revalidatePath(
      pathsConfig.app.accountMemoryChild
        .replace('[account]', data.accountSlug)
        .replace('[personId]', result.id),
    );

    return result;
  },
  { schema: UpsertFamilyChildSchema },
);
