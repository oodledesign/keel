import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { addNativeSurveyPhoto } from '~/lib/native/surveys';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return nativeBadRequest('Invalid form data');
  }

  const workspaceRef = String(form.get('workspace') ?? '').trim();
  const file = form.get('file');
  if (!workspaceRef || !(file instanceof File)) {
    return nativeBadRequest('workspace and file are required');
  }

  try {
    const { id } = await context.params;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      workspaceRef,
    );
    const photo = await addNativeSurveyPhoto({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      surveyId: id,
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'photo.jpg',
      mimeType: file.type || 'image/jpeg',
      title: String(form.get('title') ?? '').trim() || file.name,
    });
    return NextResponse.json(photo);
  } catch (error) {
    return handleNativeError(error, 'surveys');
  }
}
