import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { getOptionalWebflow } from '~/lib/feedflow/env';
import {
  feedflowAppUrl,
  feedflowErrorRedirect,
  resolveFeedflowErrorPath,
  safeFeedflowReturnPath,
} from '~/lib/feedflow/oauth-redirect';
import { signFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { buildWebflowAuthUrl } from '~/lib/feedflow/webflow/oauth';

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
      'Missing workspace. Open Reviews and click Connect with Webflow again.',
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

  if (!getOptionalWebflow()) {
    return feedflowErrorRedirect(
      request,
      earlyReturn,
      'Webflow sign-in is not configured. Use an API token instead.',
      slug,
    );
  }

  const returnPath =
    safeFeedflowReturnPath(returnParam) ??
    pathsConfig.app.accountFeedflowReviews.replace('[account]', slug);

  const state = signFeedflowOAuthState({
    provider: 'webflow',
    accountId,
    userId: user.id,
    exp: Date.now() + 10 * 60 * 1000,
    returnPath,
    clientId:
      clientIdParam && /^[0-9a-f-]{36}$/i.test(clientIdParam)
        ? clientIdParam
        : null,
  });

  return NextResponse.redirect(buildWebflowAuthUrl(state));
}
