'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { confirmSurveyGapCheckWithAi } from '~/lib/ai/survey-gap-check';
import { deskReviewSections } from '~/lib/building-surveyor/survey-desk-review';
import {
  buildSurveyGapCheck,
  mergeSurveyGapFlags,
  summariseGapFlags,
} from '~/lib/building-surveyor/survey-report-gap-check';

import {
  AddSurveyStyleExampleSchema,
  AddSurveyTranscriptSchema,
  AutoCaptionSurveyPhotosSchema,
  CheckSurveyPublishGapsSchema,
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
  revalidatePath(
    pathsConfig.app.accountSurveyReview
      .replace('[account]', accountSlug)
      .replace('[id]', proposalId),
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

export const autoCaptionSurveyPhotosAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'auto-caption-survey-photos',
        userId: user.id,
        proposalId: data.proposalId,
        sectionKey: data.sectionKey,
      },
      'Captioning empty survey photos',
    );
    const result = await getService().autoCaptionSectionPhotos(data);
    revalidateSurveyHub(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: AutoCaptionSurveyPhotosSchema },
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

export const checkSurveyPublishGapsAction = enhanceAction(
  async (data) => {
    const service = getService();
    await service.assertBuildingSurveyorAccount(data.accountId);
    await service.ensureUserAndPermission(data.accountId, 'invoices.view');
    const survey = await service.getSurvey(data.accountId, data.proposalId);
    const [observations, photos] = await Promise.all([
      service.listObservations(data.accountId, data.proposalId),
      service.listPinnedPhotos(data.accountId, data.proposalId),
    ]);

    const noteKeys = observations
      .filter((row) => row.body.trim())
      .map((row) => row.sectionKey);
    const photoCountByKey = new Map<string, number>();
    for (const photo of photos) {
      const key = photo.sectionKey;
      photoCountByKey.set(key, (photoCountByKey.get(key) ?? 0) + 1);
    }

    const sections = deskReviewSections(
      survey.survey_level ?? survey.survey_type,
      {
        noteKeys,
        photoCountByKey,
      },
    );
    const deterministic = buildSurveyGapCheck(sections);
    let flags = deterministic.flags;
    let source: 'deterministic' | 'ai' | 'passthrough' = 'deterministic';

    if (data.useAi) {
      const confirmed = await confirmSurveyGapCheckWithAi({
        accountId: data.accountId,
        supabase: getSupabaseServerClient(),
        flags: deterministic.flags,
        sections: sections.map((section) => ({
          key: section.key,
          ricsCode: section.ricsCode,
          label: section.label,
          hasNotes: section.hasNotes,
          photoCount: section.photoCount,
        })),
      });
      flags = mergeSurveyGapFlags(deterministic.flags, confirmed.flags);
      source = confirmed.source === 'ai' ? 'ai' : 'passthrough';
    }

    return {
      ...summariseGapFlags(flags),
      source,
    };
  },
  { schema: CheckSurveyPublishGapsSchema },
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
