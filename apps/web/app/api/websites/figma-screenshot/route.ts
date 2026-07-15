import { NextRequest, NextResponse } from 'next/server';

import {
  resolveActiveWebsiteShare,
  shareScopeAllowsWireframes,
  websiteShareFigmaPageUrl,
} from '~/home/[account]/websites/_lib/server/site-studio.service';
import { rateLimitApiRequest } from '~/lib/rate-limit/api-rate-limit';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * Node-only wireframe PNG capture for Figma Tier 0.
 * Auth: active website_shares token with wireframes|design|full scope.
 * Uses Playwright when installed — never runs on Edge.
 */
export async function GET(request: NextRequest) {
  const limited = rateLimitApiRequest(request, {
    scope: 'figma-screenshot',
    limit: 5,
  });
  if (limited) return limited;

  const token = request.nextUrl.searchParams.get('token')?.trim();
  const pageSlug = request.nextUrl.searchParams.get('page')?.trim();

  if (!token || !pageSlug) {
    return NextResponse.json(
      { error: 'token and page query params are required' },
      { status: 400 },
    );
  }

  const share = await resolveActiveWebsiteShare(token);
  if (!share) {
    return NextResponse.json(
      { error: 'Invalid or expired share' },
      { status: 404 },
    );
  }
  if (!shareScopeAllowsWireframes(share.scope)) {
    return NextResponse.json(
      { error: 'Share scope does not allow wireframes' },
      { status: 403 },
    );
  }

  const site =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ||
    request.nextUrl.origin;
  const path = websiteShareFigmaPageUrl(token, pageSlug).replace(
    /^https?:\/\/[^/]+/,
    '',
  );
  const importUrl = `${site}${path.startsWith('/') ? path : `/${path}`}`;

  const { captureFigmaWireframePng } =
    await import('~/lib/websites/exporters/figma-screenshots');
  const result = await captureFigmaWireframePng(importUrl);
  if (!result.png) {
    return NextResponse.json(
      {
        error: 'Screenshot unavailable',
        detail: result.skippedReason ?? 'Playwright/Chromium not available',
        importUrl,
      },
      { status: 503 },
    );
  }

  return new NextResponse(Buffer.from(result.png), {
    status: 200,
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'private, max-age=60',
    },
  });
}
