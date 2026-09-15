import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeSurvey, listNativeSurveys } from '~/lib/native/surveys';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateSurveyBodySchema = z.object({
  workspace: z.string().min(1),
  title: z.string().min(1).max(500),
  survey_type: z.string().max(80).optional().nullable(),
  client_id: z.string().uuid().optional().nullable(),
});

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const payload = await listNativeSurveys(auth.context.supabase, workspace);
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateSurveyBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const survey = await createNativeSurvey({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      title: parsed.data.title,
      surveyType: parsed.data.survey_type,
      clientId: parsed.data.client_id,
    });
    return NextResponse.json(survey);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}
