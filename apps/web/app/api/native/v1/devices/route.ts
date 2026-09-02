import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { upsertNativeDevice } from '~/lib/native/devices';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const RegisterDeviceBodySchema = z.object({
  token: z.string().min(1),
  platform: z.string().optional(),
  workspace: z.string().min(1).optional().nullable(),
});

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = RegisterDeviceBodySchema.safeParse(
      await readJsonBody(request),
    );
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = parsed.data.workspace
      ? await requireNativeWorkspace(
          auth.context.supabase,
          auth.context.userId,
          parsed.data.workspace,
        )
      : null;

    const device = await upsertNativeDevice({
      client: auth.context.supabase,
      userId: auth.context.userId,
      token: parsed.data.token,
      platform: parsed.data.platform,
      workspace,
    });

    return NextResponse.json(device);
  } catch (error) {
    return handleNativeError(error, 'devices');
  }
}
