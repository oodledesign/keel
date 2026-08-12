'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { loadUserTeamMemberships } from '~/home/_lib/server/user-team-memberships.loader';

import { SavePersonalVisionSchema } from './personal-vision.schema';
import { createPersonalVisionService } from './personal-vision.service';

export const savePersonalVisionAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    const client = getSupabaseServerClient();
    const memberships = await loadUserTeamMemberships(user.id, client);
    const allowed = new Set(memberships.map((m) => m.id));
    const financeAccountIds = data.financeAccountIds.filter((id) =>
      allowed.has(id),
    );

    const service = createPersonalVisionService(client);
    try {
      await service.saveForUser(user.id, {
        content: data.content,
        financeAccountIds,
        dashboardEnabled: data.dashboardEnabled,
      });
    } catch (error) {
      logger.error({ error, name: 'personal-vision.save' }, 'Failed to save');
      return {
        success: false as const,
        error: error instanceof Error ? error.message : 'Failed to save',
      };
    }

    revalidatePath(pathsConfig.app.personalAccountVisionSettings);
    revalidatePath(pathsConfig.app.personalVision);
    revalidatePath(pathsConfig.app.home);
    revalidatePath('/home', 'layout');
    revalidatePath('/app', 'layout');

    return { success: true as const };
  },
  {
    auth: true,
    schema: SavePersonalVisionSchema,
  },
);
