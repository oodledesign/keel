import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { upsertNativeFamilyChild } from '~/lib/native/memories';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const UpsertChildBodySchema = z.object({
  workspace: z.string().min(1),
  id: z.string().uuid().optional(),
  display_name: z.string().trim().min(1).max(80),
  date_of_birth: z.string().nullable().optional(),
  is_child: z.boolean().optional(),
});

export async function POST(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = UpsertChildBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const result = await upsertNativeFamilyChild({
      client: auth.context.supabase,
      userId: auth.context.userId,
      workspace,
      id: parsed.data.id,
      displayName: parsed.data.display_name,
      dateOfBirth: parsed.data.date_of_birth,
      isChild: parsed.data.is_child,
    });
    return NextResponse.json({ ok: true, id: result.id });
  } catch (error) {
    return handleNativeError(error, 'memories');
  }
}
