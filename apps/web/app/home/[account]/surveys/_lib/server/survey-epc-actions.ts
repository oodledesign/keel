'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { EpcApiError } from '~/lib/building-surveyor/epc/types';
import { FloodApiError } from '~/lib/building-surveyor/flood/types';
import type { SurveyFloodRecord } from '~/lib/building-surveyor/flood/types';

import {
  AttachSurveyEpcSchema,
  ClearSurveyEpcSchema,
  RefreshSurveyEpcSchema,
  SearchSurveyEpcSchema,
  SurveyPropertyLookupSchema,
  UpdateSurveyEpcSchema,
} from '../schema/survey-epc.schema';
import { createSurveyEpcService } from './survey-epc.service';
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
  return createSurveyEpcService(getSupabaseServerClient());
}

function rethrowEpc(error: unknown): never {
  if (error instanceof EpcApiError) {
    throw new Error(error.message);
  }
  throw error;
}

export const searchSurveyEpcAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'search-survey-epc',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Searching GOV.UK EPC register',
    );
    try {
      return await getService().search(data);
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: SearchSurveyEpcSchema },
);

export const saveSurveyPropertyLookupAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'save-survey-property-lookup',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving survey property lookup',
    );
    try {
      const result = await getService().saveLookup(data);
      let flood: SurveyFloodRecord | null = null;
      let floodError: string | null = null;
      if (
        data.pullFlood !== false &&
        result.lookup.latitude != null &&
        result.lookup.longitude != null
      ) {
        try {
          flood = await createSurveyFloodService(
            getSupabaseServerClient(),
          ).pull({
            accountId: data.accountId,
            accountSlug: data.accountSlug,
            proposalId: data.proposalId,
            latitude: result.lookup.latitude,
            longitude: result.lookup.longitude,
          });
        } catch (error) {
          floodError =
            error instanceof FloodApiError || error instanceof Error
              ? error.message
              : 'Flood risk could not be pulled.';
        }
      }
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return { ...result, flood, floodError };
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: SurveyPropertyLookupSchema },
);

export const attachSurveyEpcAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'attach-survey-epc',
        userId: user.id,
        proposalId: data.proposalId,
        certificateNumber: data.certificateNumber,
      },
      'Attaching GOV.UK EPC to survey',
    );
    try {
      const result = await getService().attach(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: AttachSurveyEpcSchema },
);

export const updateSurveyEpcAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'update-survey-epc',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Saving surveyor EPC overrides',
    );
    try {
      const result = await getService().update(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: UpdateSurveyEpcSchema },
);

export const refreshSurveyEpcAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'refresh-survey-epc',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Refreshing GOV.UK EPC for survey',
    );
    try {
      const result = await getService().refresh(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: RefreshSurveyEpcSchema },
);

export const clearSurveyEpcAction = enhanceAction(
  async (data, user) => {
    const logger = await getLogger();
    logger.info(
      {
        name: 'clear-survey-epc',
        userId: user.id,
        proposalId: data.proposalId,
      },
      'Clearing attached survey EPC',
    );
    try {
      const result = await getService().clear(data);
      revalidateSurveyHub(data.accountSlug, data.proposalId);
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: ClearSurveyEpcSchema },
);
