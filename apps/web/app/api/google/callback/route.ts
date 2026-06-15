import { NextResponse, type NextRequest } from 'next/server';

import { exchangeCode, upsertConnection } from '@kit/google-auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import {
  EMAIL_ASSISTANT_DEFAULT_RETURN_PATH,
  GMAIL_OAUTH_SCOPES,
} from '~/lib/email-assistant/constants';
import {
  safeReturnPath,
  verifyGoogleOAuthState,
} from '~/lib/email-assistant/oauth-state';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function expiresAtFromToken(expiresIn?: number): string | null {
  if (!expiresIn) {
    return null;
  }

  return new Date(Date.now() + expiresIn * 1000).toISOString();
}

async function fetchGoogleEmail(accessToken: string): Promise<string> {
  const response = await fetch(
    'https://gmail.googleapis.com/gmail/v1/users/me/profile',
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!response.ok) {
    throw new Error(
      `Could not load Gmail profile (${response.status}): ${(await response.text()).slice(0, 200)}`,
    );
  }

  const profile = (await response.json()) as { emailAddress?: string | null };
  const email = profile.emailAddress?.trim();

  if (!email) {
    throw new Error('Gmail profile did not include an email address');
  }

  return email;
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

  if (!(await canUseEmailAssistant(client, user.id))) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.personalAccountBilling}?addon=email-assistant`,
      ),
    );
  }

  const payload = stateToken ? verifyGoogleOAuthState(stateToken) : null;
  const returnPath = safeReturnPath(
    payload,
    EMAIL_ASSISTANT_DEFAULT_RETURN_PATH,
  );
  const returnUrl = absoluteUrl(returnPath);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${returnUrl}?email_error=${encodeURIComponent('Invalid or expired Google OAuth state')}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${returnUrl}?email_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnUrl}?email_error=${encodeURIComponent('Missing Google authorization code')}`,
    );
  }

  try {
    const tokens = await exchangeCode(code);
    const googleEmail = await fetchGoogleEmail(tokens.access_token);
    const scopes = tokens.scope?.split(/\s+/).filter(Boolean) ?? [
      ...GMAIL_OAUTH_SCOPES,
    ];

    await upsertConnection(
      user.id,
      {
        googleEmail,
        access: tokens.access_token,
        refresh: tokens.refresh_token ?? null,
        expiresAt: expiresAtFromToken(tokens.expires_in),
      },
      scopes,
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Could not connect Gmail';

    return NextResponse.redirect(
      `${returnUrl}?email_error=${encodeURIComponent(message)}`,
    );
  }

  return NextResponse.redirect(`${returnUrl}?email_connected=1`);
}
