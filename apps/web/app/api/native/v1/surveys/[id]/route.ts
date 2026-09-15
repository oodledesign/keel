import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { getNativeSurvey } from '~/lib/native/surveys';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const survey = await getNativeSurvey(auth.context.supabase, workspace, id);
    return NextResponse.json(survey);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}
