'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { FloodApiError } from '~/lib/building-surveyor/flood/types';

import {
  ConfirmSurveyAddressSchema,
  PullSurveyFloodSchema,
  UpdateSurveyFloodSchema,
  UpdateSurveyLevelSchema,
} from '../schema/survey-prep.schema';
import { createSurveyPrepService } from './survey-prep.service';

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
  revalidatePath(
    pathsConfig.app.accountSurveys.replace('[account]', accountSlug),
  );
}

function getService() {
  return createSurveyPrepService(getSupabaseServerClient());
}

function rethrowFlood(error: unknown): never {
  if (error instanceof FloodApiError) {
    throw new Error(error.message);
  }
  throw error;
}

export const confirmSurveyAddressAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'confirm-survey-address',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Confirming survey address and pulling flood / EPC',
    );
    try {
      const result = await getService().confirmAddress(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowFlood(error);
    }
  },
  { schema: ConfirmSurveyAddressSchema },
);

export const pullSurveyFloodAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'pull-survey-flood',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Pulling Environment Agency flood risk',
    );
    try {
      const result = await getService().pullFlood(data);
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
      'Saving surveyor flood-risk override',
    );
    const result = await getService().updateFlood(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyFloodSchema },
);

export const updateSurveyLevelAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-level',
        userId: user.id,
        proposalId: data.proposalId,
        surveyLevel: data.surveyLevel,
      },
      'Saving survey level',
    );
    const result = await getService().updateLevel(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyLevelSchema },
);
