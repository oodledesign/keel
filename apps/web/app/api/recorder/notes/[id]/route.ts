import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateRecorderRequest } from '~/lib/api-tokens/recorder-auth';
import { updateRecorderNote } from '~/lib/recorder/create-note';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBodySchema = z
  .object({
    title: z.string().optional(),
    content: z.string().optional(),
    category: z.string().min(1).max(64).optional().nullable(),
    client_id: z.string().uuid().optional().nullable(),
  })
  .refine(
    (value) =>
      value.title !== undefined ||
      value.content !== undefined ||
      value.category !== undefined ||
      value.client_id !== undefined,
    { message: 'No note fields to update' },
  );

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authenticateRecorderRequest(request, {
    touchLastUsed: true,
  });
  if (auth instanceof NextResponse) {
    return auth;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = PatchBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request body' },
      { status: 400 },
    );
  }

  try {
    const { id } = await params;
    const result = await updateRecorderNote({
      userId: auth.user_id,
      noteId: id,
      title: parsed.data.title,
      content: parsed.data.content,
      category: parsed.data.category,
      clientId: parsed.data.client_id,
    });
    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Failed to update note';
    const status = message.includes('not a member')
      ? 403
      : message.includes('not found')
        ? 404
        : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
