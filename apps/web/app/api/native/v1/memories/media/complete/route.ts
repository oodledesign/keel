import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { completeNativeMemoryMediaUpload } from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  workspace: z.string().min(1),
  note_id: z.string().uuid(),
  path: z.string().min(1).max(1000),
  filename: z.string().min(1).max(500),
  mime_type: z.string().max(200).optional().nullable(),
  title: z.string().max(500).optional().nullable(),
  size: z.number().int().nonnegative(),
});

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = BodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const media = await completeNativeMemoryMediaUpload({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      noteId: parsed.data.note_id,
      path: parsed.data.path,
      filename: parsed.data.filename,
      mimeType: parsed.data.mime_type ?? '',
      title: parsed.data.title ?? undefined,
      size: parsed.data.size,
    });
    return NextResponse.json(media);
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
