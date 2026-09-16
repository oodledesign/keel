import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createSurveyCaptureService } from './survey-capture.service';
import { createSurveyPhrasesService } from './survey-phrases.service';
import { createSurveyTemplatesService } from './survey-templates.service';

export async function loadSurveyHubExtras(input: {
  accountId: string;
  proposalId: string;
  clientId?: string | null;
  dealId?: string | null;
}) {
  const service = createSurveyCaptureService(getSupabaseServerClient());
  await service.assertBuildingSurveyorAccount(input.accountId);

  const client = getSupabaseServerClient();
  const [
    observations,
    transcripts,
    pinnedPhotos,
    styleExamples,
    templates,
    banks,
  ] = await Promise.all([
    service.listObservations(input.accountId, input.proposalId),
    service.listLinkedTranscripts(
      input.accountId,
      input.proposalId,
      input.clientId,
      input.dealId,
    ),
    service.listPinnedPhotos(input.accountId, input.proposalId),
    service.listStyleExamples(input.accountId),
    createSurveyTemplatesService(client).list(input.accountId),
    createSurveyPhrasesService(client).listBanks(input.accountId),
  ]);

  const survey = await service.getSurvey(input.accountId, input.proposalId);

  return {
    observations,
    transcripts,
    pinnedPhotos,
    styleExampleCount: styleExamples.length,
    photoShare: service.getPhotoShare(survey),
    templates,
    phraseBankCount: banks.length,
    surveyTemplateId: survey.survey_template_id ?? null,
  };
}
