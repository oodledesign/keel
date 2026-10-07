import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  resolveFeedflowErrorPath,
} from '~/lib/feedflow/oauth-redirect';
import { verifyFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { saveWebflowConnectionToken } from '~/lib/feedflow/webflow/connection';
import { exchangeWebflowCode } from '~/lib/feedflow/webflow/oauth';

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

  const payload = stateToken ? verifyFeedflowOAuthState(stateToken) : null;
  const returnPath = resolveFeedflowErrorPath({
    origin: request.nextUrl.origin,
    returnParam: payload?.returnPath,
    referer: request.headers.get('referer'),
  });

  if (
    !payload ||
    payload.userId !== user.id ||
    payload.provider !== 'webflow'
  ) {
    return feedflowErrorRedirect(
      request,
      returnPath,
      'Invalid or expired sign-in. Try connecting Webflow again.',
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
    // Re-check access: membership could have changed since the redirect.
    await assertFeedflowWriteAccess(payload.accountId, user.id);
    const token = await exchangeWebflowCode(code);
    await saveWebflowConnectionToken(client, {
      accountId: payload.accountId,
      clientId: payload.clientId,
      token,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Webflow connect failed';
    return feedflowErrorRedirect(request, returnPath, msg);
  }

  const done = new URL(returnPath, request.nextUrl.origin);
  done.searchParams.set('feedflow_connected', 'Webflow');
  return NextResponse.redirect(done);
}
