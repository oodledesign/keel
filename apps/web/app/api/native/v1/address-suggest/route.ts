import { NextResponse } from 'next/server';

import { suggestUkAddresses } from '~/lib/commercial/address-suggest';
import { parseNativeAddressSuggestQuery } from '~/lib/native/address-suggest-query';
import { authenticateNativeRequest } from '~/lib/native/auth';
import { handleNativeError, nativeBadRequest } from '~/lib/native/http';
import { requireNativeWorkspace } from '~/lib/native/workspace';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/native/v1/address-suggest?workspace=&q=&limit=
 * Cookie-free Bearer wrapper around the same Mapbox helper as
 * /api/commercial/address-suggest. Tokens stay server-side.
 */
export async function GET(request: Request) {
  const auth = await authenticateNativeRequest(request);
  if (!auth.ok) {
    return auth.response;
  }

  try {
    const parsed = parseNativeAddressSuggestQuery(
      new URL(request.url).searchParams,
    );
    if (!parsed.ok) {
      if (parsed.reason === 'workspace') {
        return nativeBadRequest('workspace is required');
      }
      // Short / invalid q matches commercial address-suggest: empty list, not 400.
      return NextResponse.json({ suggestions: [] });
    }

    await requireNativeWorkspace(
      auth.context.supabase,
      auth.context.userId,
      parsed.data.workspace,
    );

    try {
      const suggestions = await suggestUkAddresses(
        parsed.data.q,
        parsed.data.limit ?? 6,
      );
      return NextResponse.json({ suggestions });
    } catch (error) {
      console.error('[native/address-suggest] Mapbox failed', error);
      return NextResponse.json({ error: 'upstream_error' }, { status: 503 });
    }
  } catch (error) {
    return handleNativeError(error, 'address-suggest');
  }
}
