import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { uploadNativeMemoryPhoto } from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
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
  const noteId = String(form.get('note_id') ?? form.get('noteId') ?? '').trim();
  const file = form.get('file');
  if (!workspaceRef || !noteId || !(file instanceof File)) {
    return nativeBadRequest('workspace, note_id, and file are required');
  }

  try {
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      workspaceRef,
    );
    const photo = await uploadNativeMemoryPhoto({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      noteId,
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: file.name || 'memory.jpg',
      mimeType: file.type || 'image/jpeg',
      title: String(form.get('title') ?? '').trim() || file.name,
    });
    return NextResponse.json(photo);
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
