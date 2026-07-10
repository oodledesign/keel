import { NextResponse, type NextRequest } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { saveConferencingConnection } from '~/lib/integrations/conferencing/connection';
import {
  exchangeTeamsCode,
  fetchTeamsAccountEmail,
  verifyTeamsState,
} from '~/lib/integrations/teams/oauth';

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

  const payload = stateToken ? verifyTeamsState(stateToken) : null;
  const returnPath =
    payload?.returnPath?.startsWith('/')
      ? payload.returnPath
      : pathsConfig.app.home;
  const returnUrl = absoluteUrl(returnPath);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${returnUrl}?conferencing_error=${encodeURIComponent('Invalid or expired Teams OAuth state')}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${returnUrl}?conferencing_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnUrl}?conferencing_error=${encodeURIComponent('Missing Teams authorization code')}`,
    );
  }

  try {
    const tokens = await exchangeTeamsCode(code);
    const email = await fetchTeamsAccountEmail(tokens.access_token);
    await saveConferencingConnection(client, {
      accountId: payload.accountId,
      provider: 'teams',
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiresIn: tokens.expires_in,
      providerAccountEmail: email,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : 'Could not connect Microsoft Teams';
    return NextResponse.redirect(
      `${returnUrl}?conferencing_error=${encodeURIComponent(message)}`,
    );
  }

  return NextResponse.redirect(`${returnUrl}?conferencing_connected=teams`);
}
