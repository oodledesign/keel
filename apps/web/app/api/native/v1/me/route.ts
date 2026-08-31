import { NextResponse } from 'next/server';

import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError } from '~/lib/native/http';
import { loadNativeMe } from '~/lib/native/me';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const payload = await loadNativeMe(
      auth.context.supabase,
      auth.context.userId,
      auth.context.email,
    );
    return NextResponse.json(payload);
  } catch (error) {
    return handleNativeError(error, 'me');
  }
}
