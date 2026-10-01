'use server';

import { revalidatePath } from 'next/cache';

import { z } from 'zod';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  SaveCoverDefaultImageSchema,
  SaveDroneDefaultFeeSchema,
  SaveSurveyorProfileSchema,
  UpdateSurveyAccommodationSchema,
  UpdateSurveyCoverSchema,
  UpdateSurveyDroneSchema,
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

export const updateSurveyDroneAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-drone',
        userId: user.id,
        proposalId: data.proposalId,
        used: data.used,
      },
      'Saving survey drone details',
    );
    const result = await getService().updateDrone(data);
    revalidateSurvey(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyDroneSchema },
);

export const saveDroneDefaultFeeAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      { name: 'save-drone-default-fee', userId: user.id },
      'Saving default drone fee',
    );
    const result = await getService().saveDroneDefaultFee(data);
    revalidatePath(
      pathsConfig.app.accountSurveyorProfileSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: SaveDroneDefaultFeeSchema },
);

export const getDroneDefaultFeeAction = enhanceAction(
  async (data) => {
    const service = getService();
    return service.getDroneDefaultFee(data.accountId);
  },
  { schema: z.object({ accountId: z.string().uuid() }) },
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

export const updateSurveyCoverAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-cover',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving survey cover',
    );
    const result = await getService().updateCover(data);
    revalidateSurvey(data.accountSlug, data.proposalId);
    return result;
  },
  { schema: UpdateSurveyCoverSchema },
);

export const saveCoverDefaultImageAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      { name: 'save-cover-default-image', userId: user.id },
      'Saving default cover image',
    );
    const filePath = await getService().saveCoverDefaultImage(data);
    revalidatePath(
      pathsConfig.app.accountSurveyorProfileSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return { filePath };
  },
  { schema: SaveCoverDefaultImageSchema },
);

export const getCoverDefaultUrlAction = enhanceAction(
  async (data) => {
    const url = await getService().getCoverDefaultUrl(data.accountId);
    return { url };
  },
  { schema: z.object({ accountId: z.string().uuid() }) },
);
