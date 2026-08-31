import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { loadNativePins, saveNativePins } from '~/lib/native/pins';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PutPinsBodySchema = z.object({
  workspace: z.string().min(1).optional(),
  pins: z.array(z.unknown()).max(3),
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
    const payload = await loadNativePins(
      auth.context.supabase,
      auth.context.userId,
      workspace,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'pins');
  }
}

export async function PUT(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = PutPinsBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace ??
        new URL(request.url).searchParams.get('workspace'),
    );
    const payload = await saveNativePins({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      pins: parsed.data.pins,
    });
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'pins');
  }
}
