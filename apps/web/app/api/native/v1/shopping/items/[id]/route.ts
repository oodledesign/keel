import { NextResponse } from 'next/server';

import { z } from 'zod';

import { authenticateNativeRequest } from '~/lib/native/auth';
import {
  handleNativeError,
  nativeBadRequest,
  readJsonBody,
} from '~/lib/native/http';
import { nativeMealScope, toggleNativeShoppingItem } from '~/lib/native/meals';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PatchBodySchema = z.object({
  workspace: z.string().min(1),
  checked: z.boolean(),
});

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    const parsed = PatchBodySchema.safeParse(await readJsonBody(request));
    if (!parsed.success || !id) {
      return nativeBadRequest('Invalid request body');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );
    const result = await toggleNativeShoppingItem(
      auth.context.supabase,
      nativeMealScope(auth.context.userId, workspace),
      id,
      parsed.data.checked,
    );
    return NextResponse.json(result);
  } catch (error) {
    return handleNativeError(error, 'shopping');
  }
}
