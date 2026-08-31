import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { getOptionalTikTok } from '~/lib/feedflow/env';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  safeFeedflowReturnPath,
} from '~/lib/feedflow/oauth-redirect';
import { signFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { denyUnlessFeedflowAddon } from '~/lib/feedflow/require-feedflow-api-access';
import { buildTikTokAuthUrl } from '~/lib/feedflow/tiktok';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id');
  const returnParam = request.nextUrl.searchParams.get('return');
  const clientIdParam = request.nextUrl.searchParams.get('client_id');
  const earlyReturn =
    safeFeedflowReturnPath(returnParam) ?? pathsConfig.app.home;

  if (!accountId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.json(
      { error: 'account_id (uuid) is required' },
      { status: 400 },
    );
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    const next = encodeURIComponent(
      request.nextUrl.pathname + request.nextUrl.search,
    );
    return NextResponse.redirect(
      feedflowAppUrl(request, `${pathsConfig.auth.signIn}?next=${next}`),
    );
  }

  let slug: string;
  try {
    ({ slug } = await assertFeedflowWriteAccess(accountId, user.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    return feedflowErrorRedirect(request, earlyReturn, msg);
  }

  const addonDenied = await denyUnlessFeedflowAddon(client, user.id, accountId);
  if (addonDenied) {
    return feedflowErrorRedirect(
      request,
      earlyReturn,
      'Feedflow add-on required',
    );
  }

  if (!getOptionalTikTok()) {
    return feedflowErrorRedirect(
      request,
      earlyReturn,
      'TikTok is not configured',
    );
  }

  const defaultReturn =
    `${pathsConfig.app.accountFeedflowSocialAccounts}`.replace(
      '[account]',
      slug,
    );
  const returnPath = safeFeedflowReturnPath(returnParam) ?? defaultReturn;

  const clientUuid =
    clientIdParam && /^[0-9a-f-]{36}$/i.test(clientIdParam)
      ? clientIdParam
      : null;

  try {
    const state = signFeedflowOAuthState({
      provider: 'tiktok',
      accountId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000,
      returnPath,
      clientId: clientUuid,
    });
    const url = buildTikTokAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth start failed';
    return feedflowErrorRedirect(request, returnPath, msg);
  }
}
