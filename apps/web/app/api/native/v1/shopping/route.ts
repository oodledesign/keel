import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { getNativeShoppingList, nativeMealScope } from '~/lib/native/meals';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const weekParam = new URL(request.url).searchParams.get('week');
    const weekStart = /^\d{4}-\d{2}-\d{2}$/.test(weekParam ?? '')
      ? (weekParam as string)
      : undefined;
    const workspace = await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      new URL(request.url).searchParams.get('workspace'),
    );
    const payload = await getNativeShoppingList(
      auth.context.supabase,
      nativeMealScope(auth.context.userId, workspace),
      weekStart,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'shopping');
  }
}
