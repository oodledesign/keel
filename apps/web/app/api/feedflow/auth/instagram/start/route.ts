import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { getOptionalInstagram } from '~/lib/feedflow/env';
import { buildInstagramAuthUrl } from '~/lib/feedflow/instagram';
import { signFeedflowOAuthState } from '~/lib/feedflow/oauth-state';

import { assertFeedflowWriteAccess } from '~/lib/feedflow/assert-feedflow-write';
import { denyUnlessFeedflowAddon } from '~/lib/feedflow/require-feedflow-api-access';

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

  const addonDenied = await denyUnlessFeedflowAddon(client, user.id, accountId);
  if (addonDenied) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?feedflow_error=${encodeURIComponent('Feedflow add-on required')}`,
      ),
    );
  }

  if (!getOptionalInstagram()) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?feedflow_error=${encodeURIComponent('Instagram is not configured')}`,
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
    provider: 'instagram',
    accountId,
    userId: user.id,
    exp: Date.now() + 10 * 60 * 1000,
    returnPath,
    clientId: clientUuid,
  });

  try {
    const url = buildInstagramAuthUrl(state);
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
