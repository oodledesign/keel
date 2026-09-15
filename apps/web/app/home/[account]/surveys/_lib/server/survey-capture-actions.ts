'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  AddSurveyTranscriptSchema,
  CreateSurveyObservationSchema,
  DeleteSurveyObservationSchema,
  GenerateSurveyDraftSchema,
  UpdateSurveyObservationSchema,
  UpdateSurveyTypeSchema,
} from '../schema/survey-capture.schema';
import { createSurveyCaptureService } from './survey-capture.service';

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
  return createSurveyCaptureService(getSupabaseServerClient());
}

export const addSurveyTranscriptAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'add-survey-transcript',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Adding survey transcript',
    );
    const result = await getService().addTranscript(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: AddSurveyTranscriptSchema },
);

export const createSurveyObservationAction = enhanceAction(
  async (data) => {
    const result = await getService().createObservation(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: CreateSurveyObservationSchema },
);

export const updateSurveyObservationAction = enhanceAction(
  async (data) => {
    const result = await getService().updateObservation(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyObservationSchema },
);

export const deleteSurveyObservationAction = enhanceAction(
  async (data) => {
    const result = await getService().deleteObservation(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: DeleteSurveyObservationSchema },
);

export const updateSurveyTypeAction = enhanceAction(
  async (data) => {
    const result = await getService().updateSurveyType(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyTypeSchema },
);

export const generateSurveyDraftAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'generate-survey-draft',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Generating survey draft from grouped observations',
    );
    const result = await getService().generateDraft(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: GenerateSurveyDraftSchema },
);
