import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  exchangeGoogleCalendarCode,
  stateReturnPath,
  verifyGoogleCalendarState,
} from '~/lib/integrations/google-calendar/oauth';
import {
  loadGoogleCalendarConnection,
  saveGoogleCalendarConnection,
} from '~/lib/integrations/google-calendar/connection';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateToken = request.nextUrl.searchParams.get('state');
  const oauthError =
    request.nextUrl.searchParams.get('error_description') ??
    request.nextUrl.searchParams.get('error');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const payload = stateToken ? verifyGoogleCalendarState(stateToken) : null;
  const returnPath = stateReturnPath(payload, pathsConfig.app.personalPlanner);
  const returnUrl = absoluteUrl(returnPath);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${returnUrl}?calendar_error=${encodeURIComponent('Invalid or expired Google OAuth state')}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${returnUrl}?calendar_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnUrl}?calendar_error=${encodeURIComponent('Missing Google authorization code')}`,
    );
  }

  try {
    const existing = await loadGoogleCalendarConnection(client, user.id);
    const tokens = await exchangeGoogleCalendarCode(code);
    await saveGoogleCalendarConnection(client, {
      userId: user.id,
      tokens,
      existingRefreshToken: existing?.refreshToken ?? null,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not connect Google Calendar';
    return NextResponse.redirect(
      `${returnUrl}?calendar_error=${encodeURIComponent(message)}`,
    );
  }

  return NextResponse.redirect(`${returnUrl}?calendar_connected=1`);
}
