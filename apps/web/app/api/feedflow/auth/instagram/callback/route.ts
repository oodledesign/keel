import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { encryptSecret } from '~/lib/feedflow/crypto-tokens';
import {
  exchangeInstagramCode,
  exchangeLongLivedInstagram,
  fetchInstagramBusinessAccount,
} from '~/lib/feedflow/instagram';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  resolveFeedflowErrorPath,
} from '~/lib/feedflow/oauth-redirect';
import { verifyFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { ingestInstagramAccount } from '~/lib/feedflow/posts';
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
    slug: null,
  });

  if (
    !payload ||
    payload.userId !== user.id ||
    payload.provider !== 'instagram'
  ) {
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
    const short = await exchangeInstagramCode(code);
    const long = await exchangeLongLivedInstagram(short.accessToken);
    const ig = await fetchInstagramBusinessAccount(
      long.accessToken,
      short.userId,
    );
    const enc = encryptSecret(long.accessToken);
    const now = new Date();
    const expiresAt = new Date(
      now.getTime() + Math.max(long.expiresIn, 3600) * 1000,
    ).toISOString();

    const row = {
      account_id: payload.accountId,
      client_id: payload.clientId,
      provider: 'instagram',
      platform: 'instagram',
      external_account_id: ig.igUserId,
      platform_user_id: ig.igUserId,
      username: ig.username,
      access_token: enc,
      refresh_token: null,
      token_expires_at: expiresAt,
      token_status: 'active',
      last_refreshed_at: now.toISOString(),
      connected_at: now.toISOString(),
    };

    const { data: saved, error } = await supabaseCustomSchema(
      client,
      'feedflow',
    )
      .from('social_accounts')
      .upsert(row, {
        onConflict: 'account_id,provider,external_account_id',
      })
      .select('id')
      .single();

    if (error) {
      throw new Error(error.message);
    }

    if (saved?.id) {
      try {
        await ingestInstagramAccount(saved.id as string);
      } catch (ingestError) {
        console.error('[feedflow] instagram ingest after connect', ingestError);
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Instagram connect failed';
    return feedflowErrorRedirect(request, returnPath, msg);
  }

  const done = new URL(returnPath, request.nextUrl.origin);
  done.searchParams.set('feedflow_connected', 'instagram');
  return NextResponse.redirect(done);
}
