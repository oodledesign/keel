'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  SaveSurveyorProfileSchema,
  UpdateSurveyAccommodationSchema,
  UpdateSurveyReportDetailsSchema,
  UpdateSurveyServicesSchema,
} from '../schema/survey-report-details.schema';
import { createSurveyReportDetailsService } from './survey-report-details.service';

function getService() {
  return createSurveyReportDetailsService(getSupabaseServerClient());
}

function revalidateSurvey(accountSlug: string, proposalId: string) {
  revalidatePath(
    pathsConfig.app.accountSurveyDetail
      .replace('[account]', accountSlug)
      .replace('[id]', proposalId),
  );
}

export const updateSurveyReportDetailsAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-report-details',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving survey report details',
    );
    const result = await getService().updateDetails(data);
    revalidateSurvey(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyReportDetailsSchema },
);

export const updateSurveyAccommodationAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-accommodation',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving survey accommodation',
    );
    const result = await getService().updateAccommodation(data);
    revalidateSurvey(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyAccommodationSchema },
);

export const updateSurveyServicesAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-services',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving survey services',
    );
    const result = await getService().updateServices(data);
    revalidateSurvey(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyServicesSchema },
);

export const saveSurveyorProfileAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      { name: 'save-surveyor-profile', userId: user.id },
      'Saving surveyor profile',
    );
    const result = await getService().saveMyProfile(data);
    revalidatePath(
      pathsConfig.app.accountSurveyorProfileSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: SaveSurveyorProfileSchema },
);
