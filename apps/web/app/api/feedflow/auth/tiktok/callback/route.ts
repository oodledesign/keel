import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { encryptSecret } from '~/lib/feedflow/crypto-tokens';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  resolveFeedflowErrorPath,
} from '~/lib/feedflow/oauth-redirect';
import { verifyFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { exchangeTikTokCode } from '~/lib/feedflow/tiktok';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const dynamic = 'force-dynamic';

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
      feedflowAppUrl(request, pathsConfig.auth.signIn),
    );
  }

  let payload = null;
  try {
    payload = stateToken ? verifyFeedflowOAuthState(stateToken) : null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Invalid OAuth state';
    return feedflowErrorRedirect(
      request,
      resolveFeedflowErrorPath({
        origin: request.nextUrl.origin,
        referer: request.headers.get('referer'),
      }),
      msg,
    );
  }

  const returnPath = resolveFeedflowErrorPath({
    origin: request.nextUrl.origin,
    returnParam: payload?.returnPath,
    referer: request.headers.get('referer'),
  });

  if (!payload || payload.userId !== user.id || payload.provider !== 'tiktok') {
    return feedflowErrorRedirect(
      request,
      returnPath,
      'Invalid or expired OAuth state',
    );
  }

  if (oauthError) {
    return feedflowErrorRedirect(request, returnPath, oauthError);
  }

  if (!code) {
    return feedflowErrorRedirect(
      request,
      returnPath,
      'Missing authorization code',
    );
  }

  try {
    const tok = await exchangeTikTokCode(code);
    const encAccess = encryptSecret(tok.accessToken);
    const encRefresh = encryptSecret(tok.refreshToken);
    const expiresAt = new Date(
      Date.now() + Math.max(tok.expiresIn, 3600) * 1000,
    ).toISOString();

    const row = {
      account_id: payload.accountId,
      client_id: payload.clientId,
      provider: 'tiktok',
      platform: 'tiktok',
      external_account_id: tok.openId,
      platform_user_id: tok.openId,
      access_token: encAccess,
      refresh_token: encRefresh,
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
    const msg = e instanceof Error ? e.message : 'TikTok connect failed';
    return feedflowErrorRedirect(request, returnPath, msg);
  }

  const done = new URL(returnPath, request.nextUrl.origin);
  done.searchParams.set('feedflow_connected', 'tiktok');
  return NextResponse.redirect(done);
}
