import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { createSurveyCaptureService } from './survey-capture.service';

export async function loadSurveyHubExtras(input: {
  accountId: string;
  proposalId: string;
  clientId?: string | null;
  dealId?: string | null;
}) {
  const service = createSurveyCaptureService(getSupabaseServerClient());
  await service.assertBuildingSurveyorAccount(input.accountId);

  const [observations, transcripts, pinnedPhotos, styleExamples] =
    await Promise.all([
      service.listObservations(input.accountId, input.proposalId),
      service.listLinkedTranscripts(
        input.accountId,
        input.proposalId,
        input.clientId,
        input.dealId,
      ),
      service.listPinnedPhotos(input.accountId, input.proposalId),
      service.listStyleExamples(input.accountId),
    ]);

  const survey = await service.getSurvey(input.accountId, input.proposalId);

  return {
    observations,
    transcripts,
    pinnedPhotos,
    styleExampleCount: styleExamples.length,
    photoShare: service.getPhotoShare(survey),
  };
}
