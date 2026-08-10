import { NextResponse } from 'next/server';

import { buildEachFeedXml } from '~/lib/commercial/property-hive-feed';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public Kato-compatible EACH XML feed (separate token from Property Hive).
 * GET /api/commercial/each-feed?token=…
 *
 * Contents currently match the Property Hive feed; per-portal listing
 * selection can diverge later without changing the URL EACH already has.
 */
export async function GET(request: Request) {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-each-feed',
    limit: 60,
  });
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (!token || token.length < 32) {
    return new NextResponse('Missing or invalid feed token', { status: 401 });
  }

  try {
    const result = await buildEachFeedXml(token);
    if (!result) {
      return new NextResponse('Feed not found', { status: 404 });
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Ozer-Feed': 'each',
      },
    });
  } catch (error) {
    console.error(
      '[each-feed]',
      error instanceof Error ? error.message : error,
    );
    return new NextResponse('Feed failed', { status: 500 });
  }
}
