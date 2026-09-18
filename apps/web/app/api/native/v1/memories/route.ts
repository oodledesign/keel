import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { createNativeMemory, listNativeMemories } from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CreateMemoryBodySchema = z.object({
  workspace: z.string().min(1),
  title: z.string().max(500).optional().nullable(),
  content: z.string().min(1).max(20_000),
  occurred_at: z.string().optional().nullable(),
  kind: z.string().optional().nullable(),
  child_ids: z.array(z.string().uuid()).max(20).optional(),
});

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const params = new URL(request.url).searchParams;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      params.get('workspace'),
    );
    const payload = await listNativeMemories(auth.context.supabase, workspace, {
      childId: params.get('child'),
      kind: params.get('kind'),
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = CreateMemoryBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const created = await createNativeMemory({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      title: parsed.data.title,
      content: parsed.data.content,
      occurredAt: parsed.data.occurred_at,
      kind: parsed.data.kind,
      childIds: parsed.data.child_ids,
    });
    return NextResponse.json({ ok: true, id: created.id });
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
