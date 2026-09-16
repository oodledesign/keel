'use server';

import { revalidatePath } from 'next/cache';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';

import {
  DeleteSurveyPhraseBankSchema,
  ImportGoreportPhrasesSchema,
  ListSurveyPhrasesSchema,
} from '../schema/survey-phrases.schema';
import { createSurveyPhrasesService } from './survey-phrases.service';

function getService() {
  return createSurveyPhrasesService(getSupabaseServerClient());
}

export const importGoreportPhrasesAction = enhanceAction(
  async (data) => {
    const result = await getService().importGoreport(data);
    revalidatePath(
      pathsConfig.app.accountSurveyPhrasesSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: ImportGoreportPhrasesSchema },
);

export const listSurveyPhrasesAction = enhanceAction(
  async (data) => getService().listPhrases(data),
  { schema: ListSurveyPhrasesSchema },
);

export const deleteSurveyPhraseBankAction = enhanceAction(
  async (data) => {
    const result = await getService().removeBank(data);
    revalidatePath(
      pathsConfig.app.accountSurveyPhrasesSettings.replace(
        '[account]',
        data.accountSlug,
      ),
    );
    return result;
  },
  { schema: DeleteSurveyPhraseBankSchema },
);
