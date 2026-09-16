import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { isGovUkEpcConfigured } from '~/lib/building-surveyor/epc/env';

import { createSurveyCaptureService } from './survey-capture.service';
import { createSurveyEpcService } from './survey-epc.service';

export async function loadSurveyHubExtras(input: {
  accountId: string;
  proposalId: string;
  clientId?: string | null;
  dealId?: string | null;
}) {
  const client = getSupabaseServerClient();
  const service = createSurveyCaptureService(client);
  const epcService = createSurveyEpcService(client);
  await service.assertBuildingSurveyorAccount(input.accountId);

  const [
    observations,
    transcripts,
    pinnedPhotos,
    styleExamples,
    attachedEpc,
    propertyLookup,
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
    epcService.getAttached(input.accountId, input.proposalId),
    epcService.getLookup(input.accountId, input.proposalId),
  ]);

  const survey = await service.getSurvey(input.accountId, input.proposalId);

  return {
    observations,
    transcripts,
    pinnedPhotos,
    styleExampleCount: styleExamples.length,
    photoShare: service.getPhotoShare(survey),
    attachedEpc,
    propertyLookup,
    epcConfigured: isGovUkEpcConfigured(),
  };
}
