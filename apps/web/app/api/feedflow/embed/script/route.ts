import { type NextRequest, NextResponse } from 'next/server';

import { z } from 'zod';

import {
  FEEDFLOW_EMBED_KEY_PATTERN,
  buildEmbedLoaderScript,
  siteOriginFromEnv,
} from '~/lib/feedflow/embed';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  widget: z.string().regex(FEEDFLOW_EMBED_KEY_PATTERN),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams),
  );

  if (!parsed.success) {
    return new NextResponse('/* invalid widget key */', {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/javascript; charset=utf-8',
      },
    });
  }

  const origin =
    siteOriginFromEnv() || request.nextUrl.origin.replace(/\/$/, '');
  const script = buildEmbedLoaderScript(origin, parsed.data.widget);

  return new NextResponse(script, {
    status: 200,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/javascript; charset=utf-8',
    },
  });
}
