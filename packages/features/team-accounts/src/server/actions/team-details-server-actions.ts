'use server';

import { redirect } from 'next/navigation';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { UpdateTeamNameSchema } from '../../schema/update-team-name.schema';

export const updateTeamAccountName = enhanceAction(
  async (params) => {
    const client = getSupabaseServerClient();
    const logger = await getLogger();
    const { name, path, slug, newSlug } = params;

    const slugToUpdate = newSlug ?? slug;

    const ctx = {
      name: 'team-accounts.update',
      accountName: name,
    };

    logger.info(ctx, `Updating team name...`);

    const { error, data } = await client
      .from('accounts')
      .update({
        name,
        slug: slugToUpdate,
      })
      .match({
        slug,
      })
      .select('slug')
      .single();

    if (error) {
      // Handle duplicate slug error
      if (error.code === '23505') {
        return {
          success: false,
          error: 'teams:duplicateSlugError',
        };
      }

      logger.error({ ...ctx, error }, `Failed to update team name`);

      throw error;
    }

    const updatedSlug = data.slug;

    logger.info(ctx, `Team name updated`);

    if (updatedSlug && updatedSlug !== slug) {
      const nextPath = path.replace('[account]', updatedSlug);

      redirect(nextPath);
    }

    return { success: true };
  },
  {
    schema: UpdateTeamNameSchema,
  },
);
