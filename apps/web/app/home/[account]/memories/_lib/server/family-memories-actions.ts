'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { upsertHouseholdMemberAction } from '~/home/(user)/life/family/_lib/household-actions';
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
  async (data) => {
    let dietaryTags: string[] = [];
    let excludedIngredients: string[] = [];

    if (data.id) {
      const scope = await resolveMealPlanScope(data.accountSlug);
      if (scope.kind === 'workspace') {
        const client = getSupabaseServerClient();
        const service = createFamilyMemoriesService(client);
        const existing = await service.getHouseholdMember(
          scope.accountId,
          data.id,
        );
        dietaryTags = existing?.dietary_tags ?? [];
        excludedIngredients = existing?.excluded_ingredients ?? [];
      }
    }

    const result = await upsertHouseholdMemberAction({
      id: data.id,
      accountSlug: data.accountSlug,
      displayName: data.displayName,
      dietaryTags,
      excludedIngredients,
      isChild: data.isChild ?? true,
      dateOfBirth: data.dateOfBirth,
      avatarPath: data.avatarPath,
    });

    if (!result.success) {
      throw new Error(result.error);
    }

    revalidateMemoryPaths(data.accountSlug);
    return result.data;
  },
  { schema: UpsertFamilyChildSchema },
);
