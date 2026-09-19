import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readFormBlob,
} from '~/lib/native/http';
import {
  parseNativeMemoryFormFile,
  uploadNativeMemoryMedia,
} from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

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
  const file = readFormBlob(form);
  if (!workspaceRef || !noteId || !file) {
    return nativeBadRequest('workspace, note_id, and file are required');
  }

  try {
    const meta = parseNativeMemoryFormFile(file);
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      workspaceRef,
    );
    const photo = await uploadNativeMemoryMedia({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      noteId,
      bytes: Buffer.from(await file.arrayBuffer()),
      filename: meta.filename,
      mimeType: meta.mimeType,
      title: String(form.get('title') ?? '').trim() || meta.filename,
    });
    return NextResponse.json(photo);
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
