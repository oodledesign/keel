import { NextResponse } from 'next/server';

import { markOpen } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

const PIXEL = Buffer.from(
  'R0lGODlhAQABAPAAAP///wAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==',
  'base64',
);

export async function GET(request: Request) {
  const url = new URL(request.url);
  const metricId = url.searchParams.get('rid');
  const campaignId = url.searchParams.get('cid');

  if (campaignId && metricId) {
    await markOpen(metricId);
  }

  return new Response(PIXEL, {
    headers: {
      'content-type': 'image/gif',
      'cache-control': 'no-store, max-age=0',
    },
  });
}
