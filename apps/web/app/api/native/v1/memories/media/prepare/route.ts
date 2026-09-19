import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { prepareNativeMemoryMediaUpload } from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  workspace: z.string().min(1),
  note_id: z.string().uuid(),
  filename: z.string().min(1).max(500),
  mime_type: z.string().max(200).optional().nullable(),
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
      return nativeBadRequest('workspace, note_id, filename, and size are required');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const prepared = await prepareNativeMemoryMediaUpload({
      client: auth.context.supabase,
      workspace,
      noteId: parsed.data.note_id,
      filename: parsed.data.filename,
      mimeType: parsed.data.mime_type ?? '',
      size: parsed.data.size,
    });
    return NextResponse.json(prepared);
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
