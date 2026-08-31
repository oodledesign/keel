import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { updateNativeNote } from '~/lib/native/notes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchNoteBodySchema = z
  .object({
    title: z.string().optional(),
    body: z.string().optional(),
  })
  .refine((value) => value.title !== undefined || value.body !== undefined, {
    message: 'No note fields to update',
  });

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await params;
    const parsed = PatchNoteBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const note = await updateNativeNote({
      client: auth.context.supabase,
      userId: auth.context.userId,
      noteId: id,
      title: parsed.data.title,
      body: parsed.data.body,
    });
    return NextResponse.json(note);
  } catch (error) {
    return handleNativeError(error, 'notes');
  }
}
