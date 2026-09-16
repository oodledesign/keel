'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  CloneSurveyTemplateSchema,
  DeleteSurveyTemplateSchema,
  UpdateSurveyTemplateSchema,
} from '../schema/survey-templates.schema';
import { createSurveyTemplatesService } from './survey-templates.service';

function revalidateTemplates(accountSlug: string) {
  revalidatePath(
    pathsConfig.app.accountSurveyTemplatesSettings.replace(
      '[account]',
      accountSlug,
    ),
  );
}

function getService() {
  return createSurveyTemplatesService(getSupabaseServerClient());
}

export const cloneSurveyTemplateAction = enhanceAction(
  async (data) => {
    const result = await getService().clone(data);
    revalidateTemplates(data.accountSlug);
    return result;
  },
  { schema: CloneSurveyTemplateSchema },
);

export const updateSurveyTemplateAction = enhanceAction(
  async (data) => {
    const result = await getService().update(data);
    revalidateTemplates(data.accountSlug);
    return result;
  },
  { schema: UpdateSurveyTemplateSchema },
);

export const deleteSurveyTemplateAction = enhanceAction(
  async (data) => {
    const result = await getService().remove(data);
    revalidateTemplates(data.accountSlug);
    return result;
  },
  { schema: DeleteSurveyTemplateSchema },
);
