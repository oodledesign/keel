import { NextResponse } from 'next/server';

import { uploadChatThreadImage } from '~/lib/messages/upload-chat-image';
import { authenticateNativeRequest } from '~/lib/native/auth';
import { nativeBadRequest } from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return nativeBadRequest('Invalid form data');
  }

  const workspaceRef = String(formData.get('workspace') ?? '').trim();
  const threadId = String(formData.get('threadId') ?? '').trim();
  const file = formData.get('file');

  if (!workspaceRef || !threadId || !(file instanceof File)) {
    return nativeBadRequest('workspace, threadId, and file are required');
  }

  try {
    await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      workspaceRef,
    );
    const uploaded = await uploadChatThreadImage({
      userId: auth.context.userId,
      threadId,
      bytes: Buffer.from(await file.arrayBuffer()),
      contentType: file.type || 'image/jpeg',
      fileName: file.name,
      size: file.size,
    });
    return NextResponse.json({
      image_url: uploaded.imageUrl,
      imageUrl: uploaded.imageUrl,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to upload image.';
    const lower = message.toLowerCase();
    const status = lower.includes('access')
      ? 403
      : lower.includes('not found')
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
