import { type NextRequest, NextResponse } from 'next/server';

import pathsConfig from '~/config/paths.config';
import { getOptionalGoogle } from '~/lib/feedflow/env';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

/**
 * Placeholder for Google Business / OAuth wiring into `feedflow.google_accounts`.
 * Configure GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI to implement.
 */
export async function GET(request: NextRequest) {
  const returnParam = request.nextUrl.searchParams.get('return');
  const base = returnParam?.startsWith('/') ? absoluteUrl(returnParam) : absoluteUrl(pathsConfig.app.home);

  if (!getOptionalGoogle()) {
    return NextResponse.redirect(
      `${base}?feedflow_error=${encodeURIComponent('Google OAuth is not configured')}`,
    );
  }

  return NextResponse.redirect(
    `${base}?feedflow_error=${encodeURIComponent('Google Business connect is not implemented yet. Use Instagram or TikTok for social_accounts, or add a google_accounts OAuth flow.')}`,
  );
}
