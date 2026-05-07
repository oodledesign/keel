import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { encryptSecret } from '~/lib/feedflow/crypto-tokens';
import {
  exchangeInstagramCode,
  exchangeLongLivedInstagram,
  fetchInstagramBusinessAccount,
} from '~/lib/feedflow/instagram';
import { verifyFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const stateToken = url.searchParams.get('state');
  const oauthError =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(
      absoluteUrl(pathsConfig.auth.signIn),
    );
  }

  const payload = stateToken
    ? verifyFeedflowOAuthState(stateToken)
    : null;

  const fallback = absoluteUrl(pathsConfig.app.home);

  if (
    !payload ||
    payload.userId !== user.id ||
    payload.provider !== 'instagram'
  ) {
    return NextResponse.redirect(
      `${fallback}?feedflow_error=${encodeURIComponent('Invalid or expired OAuth state')}`,
    );
  }

  const returnBase = payload.returnPath.startsWith('/')
    ? absoluteUrl(payload.returnPath)
    : fallback;

  if (oauthError) {
    return NextResponse.redirect(
      `${returnBase}?feedflow_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnBase}?feedflow_error=${encodeURIComponent('Missing authorization code')}`,
    );
  }

  try {
    const short = await exchangeInstagramCode(code);
    const long = await exchangeLongLivedInstagram(short.accessToken);
    const ig = await fetchInstagramBusinessAccount(long.accessToken);
    const enc = encryptSecret(ig.pageAccessToken);
    const expiresAt = new Date(
      Date.now() + Math.max(long.expiresIn, 3600) * 1000,
    ).toISOString();

    const row = {
      account_id: payload.accountId,
      client_id: payload.clientId,
      provider: 'instagram',
      platform: 'instagram',
      external_account_id: ig.igUserId,
      platform_user_id: ig.igUserId,
      access_token: enc,
      refresh_token: null,
      token_expires_at: expiresAt,
    };

    const { error } = await supabaseCustomSchema(client, 'feedflow')
      .from('social_accounts')
      .upsert(row, {
        onConflict: 'account_id,provider,external_account_id',
      });

    if (error) {
      throw new Error(error.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Instagram connect failed';
    return NextResponse.redirect(
      `${returnBase}?feedflow_error=${encodeURIComponent(msg)}`,
    );
  }

  return NextResponse.redirect(`${returnBase}?feedflow_connected=instagram`);
}
