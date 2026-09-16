'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { FloodApiError } from '~/lib/building-surveyor/flood/types';

import {
  ClearSurveyFloodSchema,
  PullSurveyFloodSchema,
  UpdateSurveyFloodSchema,
} from '../schema/survey-flood.schema';
import { createSurveyFloodService } from './survey-flood.service';

function revalidateSurveyHub(accountSlug: string, proposalId: string) {
  revalidatePath(
    pathsConfig.app.accountSurveyDetail
      .replace('[account]', accountSlug)
      .replace('[id]', proposalId),
  );
  revalidatePath(
    pathsConfig.app.accountSurveyEdit
      .replace('[account]', accountSlug)
      .replace('[id]', proposalId),
  );
}

function getService() {
  return createSurveyFloodService(getSupabaseServerClient());
}

function rethrowFlood(error: unknown): never {
  if (error instanceof FloodApiError) {
    throw new Error(error.message);
  }
  throw error;
}

export const pullSurveyFloodAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'pull-survey-flood',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Pulling Environment Agency flood risk for survey',
    );
    try {
      const result = await getService().pull(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowFlood(error);
    }
  },
  { schema: PullSurveyFloodSchema },
);

export const updateSurveyFloodAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-flood',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving surveyor flood overrides',
    );
    try {
      const result = await getService().update(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowFlood(error);
    }
  },
  { schema: UpdateSurveyFloodSchema },
);

export const clearSurveyFloodAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'clear-survey-flood',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Clearing attached survey flood risk',
    );
    try {
      const result = await getService().clear(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowFlood(error);
    }
  },
  { schema: ClearSurveyFloodSchema },
);
