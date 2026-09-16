import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { updateNativeSurveyPrep } from '~/lib/native/surveys';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  workspace: z.string().min(1),
  address: z.string().max(500).nullable().optional(),
  postcode: z.string().max(16).nullable().optional(),
  uprn: z.string().max(20).nullable().optional(),
  survey_level: z.union([z.literal(2), z.literal(3)]).optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const parsed = BodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const survey = await updateNativeSurveyPrep({
      client: auth.context.supabase,
      workspace,
      surveyId: id,
      address: parsed.data.address,
      postcode: parsed.data.postcode,
      uprn: parsed.data.uprn,
      surveyLevel: parsed.data.survey_level,
    });
    return NextResponse.json(survey);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}
