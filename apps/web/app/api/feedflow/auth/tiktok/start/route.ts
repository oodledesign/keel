import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getOptionalTikTok } from '~/lib/feedflow/env';
import { buildTikTokAuthUrl } from '~/lib/feedflow/tiktok';
import { signFeedflowOAuthState } from '~/lib/feedflow/oauth-state';
import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id');
  const returnParam = request.nextUrl.searchParams.get('return');
  const clientIdParam = request.nextUrl.searchParams.get('client_id');

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
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search);
    return NextResponse.redirect(
      absoluteUrl(`${pathsConfig.auth.signIn}?next=${next}`),
    );
  }

  let slug: string;
  try {
    ({ slug } = await assertFeedflowWriteAccess(accountId, user.id));
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Forbidden';
    return NextResponse.redirect(
      absoluteUrl(`${pathsConfig.app.home}?feedflow_error=${encodeURIComponent(msg)}`),
    );
  }

  if (!getOptionalTikTok()) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?feedflow_error=${encodeURIComponent('TikTok is not configured')}`,
      ),
    );
  }

  const defaultReturn = `${pathsConfig.app.accountFeedflowSocialAccounts}`.replace(
    '[account]',
    slug,
  );
  const returnPath =
    returnParam && returnParam.startsWith('/') ? returnParam : defaultReturn;

  const clientUuid =
    clientIdParam && /^[0-9a-f-]{36}$/i.test(clientIdParam) ? clientIdParam : null;

  const state = signFeedflowOAuthState({
    provider: 'tiktok',
    accountId,
    userId: user.id,
    exp: Date.now() + 10 * 60 * 1000,
    returnPath,
    clientId: clientUuid,
  });

  try {
    const url = buildTikTokAuthUrl(state);
    return NextResponse.redirect(url);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'OAuth start failed';
    return NextResponse.redirect(
      absoluteUrl(
        `${returnPath}?feedflow_error=${encodeURIComponent(msg)}`,
      ),
    );
  }
}
