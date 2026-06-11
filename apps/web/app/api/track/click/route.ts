import { NextResponse } from 'next/server';

import { markClick } from '~/lib/admin-email/campaigns';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const metricId = url.searchParams.get('rid');
  const campaignId = url.searchParams.get('cid');
  const target = url.searchParams.get('url');

  if (campaignId && metricId) {
    await markClick(metricId);
  }

  if (!target) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    const decoded = decodeURIComponent(target);
    const redirectUrl = new URL(decoded);

    if (!['http:', 'https:'].includes(redirectUrl.protocol)) {
      throw new Error('Invalid protocol');
    }

    return NextResponse.redirect(redirectUrl);
  } catch {
    return NextResponse.redirect(new URL('/', request.url));
  }
}
