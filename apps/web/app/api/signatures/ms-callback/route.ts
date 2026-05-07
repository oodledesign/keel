import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertAccountAdmin } from '~/lib/signatures/account-access';
import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';
import { decodeMsOAuthState } from '~/lib/signatures/ms-oauth-state';

export const dynamic = 'force-dynamic';

const MS_TOKEN =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');

  const decodedState = decodeMsOAuthState(stateRaw);
  const accountId = decodedState?.accountId ?? null;

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  const fallbackHome = absoluteUrl(pathsConfig.app.home);

  if (!user) {
    return NextResponse.redirect(
      absoluteUrl(pathsConfig.auth.signIn),
    );
  }

  if (!accountId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.redirect(
      `${fallbackHome}?signatures_error=${encodeURIComponent('Invalid OAuth state')}`,
    );
  }

  let settingsPath = pathsConfig.app.home;

  if (decodedState?.slug) {
    settingsPath = `${pathsConfig.app.accountSignaturesSettings}`.replace(
      '[account]',
      decodedState.slug,
    );
  } else {
    const { data: accountRow } = await client
      .from('accounts')
      .select('slug')
      .eq('id', accountId)
      .maybeSingle();

    const slug =
      typeof accountRow?.slug === 'string' ? accountRow.slug.trim() : '';
    if (slug.length > 0) {
      settingsPath = `${pathsConfig.app.accountSignaturesSettings}`.replace(
        '[account]',
        slug,
      );
    }
  }

  const returnBase = absoluteUrl(settingsPath);

  const forbidden = await assertAccountAdmin(client, accountId, user.id);
  if (forbidden) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Account admin required')}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Missing authorization code')}`,
    );
  }

  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret = process.env.AZURE_CLIENT_SECRET?.trim();
  const redirectUri =
    process.env.AZURE_REDIRECT_URI?.trim() ??
    absoluteUrl('/api/signatures/ms-callback');

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Microsoft OAuth is not configured')}`,
    );
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(MS_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (
      !tokenRes.ok ||
      !tokenJson.access_token ||
      typeof tokenJson.access_token !== 'string'
    ) {
      const msg =
        tokenJson.error_description ??
        tokenJson.error ??
        'Token exchange failed';
      throw new Error(msg);
    }

    const claims = decodeJwtPayload(tokenJson.access_token);
    const tid = claims?.tid;
    const msTenantId =
      typeof tid === 'string' && tid.length > 0 ? tid : null;

    if (!msTenantId) {
      throw new Error('Could not read tenant id from token');
    }

    const expiresIn = tokenJson.expires_in ?? 3600;
    const tokenExpiresAt = new Date(
      Date.now() + Math.max(60, expiresIn) * 1000,
    ).toISOString();

    const db = getSignaturesSupabaseClient();
    const { error: upErr } = await db.from('ms_connections').upsert(
      {
        account_id: accountId,
        ms_tenant_id: msTenantId,
        access_token: tokenJson.access_token,
        refresh_token: tokenJson.refresh_token ?? null,
        token_expires_at: tokenExpiresAt,
        connected_by: user.id,
      },
      { onConflict: 'account_id' },
    );

    if (upErr) {
      throw new Error(upErr.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Microsoft connect failed';
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent(msg)}`,
    );
  }

  return NextResponse.redirect(`${returnBase}?connected=true`);
}
