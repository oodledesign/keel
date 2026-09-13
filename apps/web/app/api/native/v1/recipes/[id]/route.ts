import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { getNativeRecipe, nativeMealScope } from '~/lib/native/meals';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const { id } = await context.params;
    if (!id) {
      return nativeBadRequest('Recipe id is required');
    }

    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const recipe = await getNativeRecipe(
      auth.context.supabase,
      nativeMealScope(auth.context.userId, workspace),
      id,
    );
    return NextResponse.json(recipe);
  } catch (error) {
    return handleNativeError(error, 'recipes');
  }
}
