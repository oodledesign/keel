'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  AddSurveyStyleExampleSchema,
  AddSurveyTranscriptSchema,
  CreateSurveyObservationSchema,
  DeleteSurveyObservationSchema,
  DeleteSurveyStyleExampleSchema,
  GenerateSurveyDraftSchema,
  ProposeSurveyPhotoCurationSchema,
  ReorderSurveyPhotosSchema,
  SetSurveyPhotoShareSchema,
  UpdateSurveyObservationSchema,
  UpdateSurveyPhotoCurationSchema,
  UpdateSurveyStyleExampleSchema,
  UpdateSurveyTypeSchema,
} from '../schema/survey-capture.schema';
import { createSurveyCaptureService } from './survey-capture.service';
import { createSurveyStyleService } from './survey-style.service';

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

function getStyleService() {
  return createSurveyStyleService(getSupabaseServerClient());
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

export const proposeSurveyPhotoCurationAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'propose-survey-photo-curation',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Proposing curated survey photos',
    );
    const result = await getService().proposePhotoCuration(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: ProposeSurveyPhotoCurationSchema },
);

export const updateSurveyPhotoCurationAction = enhanceAction(
  async (data) => {
    const result = await getService().updatePhotoCuration(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyPhotoCurationSchema },
);

export const reorderSurveyPhotosAction = enhanceAction(
  async (data) => {
    const result = await getService().reorderCuratedPhotos(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: ReorderSurveyPhotosSchema },
);

export const setSurveyPhotoShareAction = enhanceAction(
  async (data) => {
    const result = await getService().setPhotoShare(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: SetSurveyPhotoShareSchema },
);

export const addSurveyStyleExampleAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'add-survey-style-example',
        userId: user.id,
        accountId: data.accountId,
      },
      'Adding survey style example',
    );
    const result = await getStyleService().add(data);
    revalidatePath(
      pathsConfig.app.accountSurveyStyleSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: AddSurveyStyleExampleSchema },
);

export const updateSurveyStyleExampleAction = enhanceAction(
  async (data) => {
    const result = await getStyleService().update(data);
    revalidatePath(
      pathsConfig.app.accountSurveyStyleSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: UpdateSurveyStyleExampleSchema },
);

export const deleteSurveyStyleExampleAction = enhanceAction(
  async (data) => {
    const result = await getStyleService().remove(data);
    revalidatePath(
      pathsConfig.app.accountSurveyStyleSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: DeleteSurveyStyleExampleSchema },
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
