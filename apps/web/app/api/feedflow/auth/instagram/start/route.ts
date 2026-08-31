import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { getOptionalInstagram } from '~/lib/feedflow/env';
import { buildInstagramAuthUrl } from '~/lib/feedflow/instagram';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  resolveFeedflowErrorPath,
  safeFeedflowReturnPath,
} from '~/lib/feedflow/oauth-redirect';
import { signFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { denyUnlessFeedflowAddon } from '~/lib/feedflow/require-feedflow-api-access';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id');
  const returnParam = request.nextUrl.searchParams.get('return');
  const clientIdParam = request.nextUrl.searchParams.get('client_id');
  const earlyReturn = resolveFeedflowErrorPath({
    origin: request.nextUrl.origin,
    returnParam,
    referer: request.headers.get('referer'),
  });

  if (!accountId?.match(/^[0-9a-f-]{36}$/i)) {
    return feedflowErrorRedirect(
      request,
      earlyReturn,
      'Missing workspace. Open Social accounts and click Connect Instagram again.',
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
      slug,
    );
  }

  if (!getOptionalInstagram()) {
    return feedflowErrorRedirect(
      request,
      earlyReturn,
      'Instagram is not configured. Set FEEDFLOW_INSTAGRAM_APP_ID, FEEDFLOW_INSTAGRAM_APP_SECRET, and FEEDFLOW_INSTAGRAM_REDIRECT_URI.',
      slug,
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
      provider: 'instagram',
      accountId,
      userId: user.id,
      exp: Date.now() + 10 * 60 * 1000,
      returnPath,
      clientId: clientUuid,
    });
    const url = buildInstagramAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth start failed';
    return feedflowErrorRedirect(request, returnPath, msg, slug);
  }
}
