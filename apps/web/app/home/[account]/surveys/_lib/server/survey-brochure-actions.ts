'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  ApplySurveyBrochureSchema,
  PreviewSurveyBrochureSchema,
} from '../schema/survey-brochure.schema';
import { createSurveyBrochureService } from './survey-brochure.service';

function service() {
  return createSurveyBrochureService(getSupabaseServerClient());
}

export const previewSurveyBrochureAction = enhanceAction(
  async (data) => service().preview(data),
  { schema: PreviewSurveyBrochureSchema },
);

export const applySurveyBrochureAction = enhanceAction(
  async (data) => service().apply(data),
  { schema: ApplySurveyBrochureSchema },
);
