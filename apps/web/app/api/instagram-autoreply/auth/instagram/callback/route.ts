import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { encryptIgToken } from '~/lib/instagram-autoreply/token-crypto';
import {
  exchangeInstagramAutoreplyCode,
  exchangeLongLivedInstagramAutoreply,
  fetchInstagramAutoreplyBusinessAccount,
} from '~/lib/instagram-autoreply/instagram-oauth';
import { verifyIgAutoreplyOAuthState, isSafeOAuthReturnPath } from '~/lib/instagram-autoreply/oauth-state';

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
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const payload = stateToken ? verifyIgAutoreplyOAuthState(stateToken) : null;
  const fallback = absoluteUrl(pathsConfig.app.home);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${fallback}?instagram_error=${encodeURIComponent('Invalid or expired OAuth state')}`,
    );
  }

  const returnBase = isSafeOAuthReturnPath(payload.returnPath)
    ? absoluteUrl(payload.returnPath)
    : fallback;

  if (oauthError) {
    return NextResponse.redirect(
      `${returnBase}?instagram_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnBase}?instagram_error=${encodeURIComponent('Missing authorization code')}`,
    );
  }

  try {
    const short = await exchangeInstagramAutoreplyCode(code);
    const long = await exchangeLongLivedInstagramAutoreply(short.accessToken);
    const ig = await fetchInstagramAutoreplyBusinessAccount(long.accessToken);
    const enc = encryptIgToken(ig.pageAccessToken);
    const expiresAt = new Date(
      Date.now() + Math.max(long.expiresIn, 3600) * 1000,
    ).toISOString();

    const { error } = await client.from('ig_connected_accounts').upsert(
      {
        account_id: payload.accountId,
        ig_business_account_id: ig.igUserId,
        ig_username: ig.username,
        facebook_page_id: ig.pageId,
        access_token: enc,
        token_expires_at: expiresAt,
        is_active: true,
      },
      { onConflict: 'account_id' },
    );

    if (error) {
      throw new Error(error.message);
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Instagram connect failed';
    return NextResponse.redirect(
      `${returnBase}?instagram_error=${encodeURIComponent(msg)}`,
    );
  }

  return NextResponse.redirect(`${returnBase}?instagram_connected=1`);
}
