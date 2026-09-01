import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeNote, listNativeNotes } from '~/lib/native/notes';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateNoteBodySchema = z.object({
  title: z.string().optional(),
  body: z.string().min(1),
  workspace: z.string().min(1),
  category: z.string().min(1).max(64).optional(),
  tags: z.array(z.string().min(1).max(40)).max(12).optional(),
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
    const items = await listNativeNotes(auth.context.userId, workspace);
    return NextResponse.json({ items });
  } catch (error) {
    return handleNativeError(error, 'notes');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateNoteBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const note = await createNativeNote({
      userId: auth.context.userId,
      workspace,
      body: parsed.data.body,
      title: parsed.data.title,
      category: parsed.data.category,
      tags: parsed.data.tags,
    });
    return NextResponse.json(note);
  } catch (error) {
    return handleNativeError(error, 'notes');
  }
}
