import { NextResponse } from 'next/server';

import { buildPropertyHiveFeedXml } from '~/lib/commercial/property-hive-feed';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * Public Kato-compatible Property Hive XML feed.
 * GET /api/commercial/property-hive-feed?token=…
 *
 * Point Property Hive Import (Kato XML or generic XML) at this URL and set
 * frequency to every 15 minutes.
 */
export async function GET(request: Request) {
  const limited = rateLimitApiRequest(request, {
    scope: 'commercial-property-hive-feed',
    limit: 60,
  });
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (!token || token.length < 32) {
    return new NextResponse('Missing or invalid feed token', { status: 401 });
  }

  try {
    const result = await buildPropertyHiveFeedXml(token);
    if (!result) {
      return new NextResponse('Feed not found', { status: 404 });
    }

    return new NextResponse(result.xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/xml; charset=utf-8',
        'Cache-Control': 'public, max-age=60, s-maxage=60',
        'X-Ozer-Feed': 'property-hive',
      },
    });
  } catch (error) {
    console.error(
      '[property-hive-feed]',
      error instanceof Error ? error.message : error,
    );
    return new NextResponse('Feed failed', { status: 500 });
  }
}
