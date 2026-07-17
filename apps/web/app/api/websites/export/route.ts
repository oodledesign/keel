import { NextResponse } from 'next/server';

import { resolveActiveWebsiteShare } from '~/home/[account]/websites/_lib/server/site-studio.service';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';
import { buildExport } from '~/lib/websites/export-contract';

export const dynamic = 'force-dynamic';

/**
 * Public SiteStudioExport JSON for a full-scope share token.
 * GET /api/websites/export?token=…
 */
export async function GET(request: Request) {
  const limited = rateLimitApiRequest(request, {
    scope: 'websites-export',
    limit: 30,
  });
  if (limited) return limited;

  const token = new URL(request.url).searchParams.get('token')?.trim() ?? '';
  if (!token) {
    return NextResponse.json({ error: 'Missing share token' }, { status: 400 });
  }

  const share = await resolveActiveWebsiteShare(token);
  if (!share || share.scope !== 'full') {
    return NextResponse.json(
      { error: 'Share link not found, expired, or insufficient scope' },
      { status: 404 },
    );
  }

  try {
    const document = await buildExport(share.websiteId);
    return NextResponse.json(document, {
      headers: {
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Website not found') {
      return NextResponse.json({ error: 'Website not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Export failed' }, { status: 500 });
  }
}
