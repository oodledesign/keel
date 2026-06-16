import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertAccountAdmin } from '~/lib/signatures/account-access';
import { signSignaturesMsOAuthState } from '~/lib/signatures/signatures-oauth-state';

export const dynamic = 'force-dynamic';

const MS_AUTHORIZE =
  'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';

const SCOPES =
  'MailboxSettings.ReadWrite User.Read.All ProfilePhoto.Read.All offline_access';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const accountId = request.nextUrl.searchParams.get('account_id');
  const accountSlug =
    request.nextUrl.searchParams.get('account_slug')?.trim() || null;

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
      absoluteUrl(`${pathsConfig.auth.signIn}?next=${next}`),
    );
  }

  const forbidden = await assertAccountAdmin(client, accountId, user.id);
  if (forbidden) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?signatures_error=${encodeURIComponent('Account admin required')}`,
      ),
    );
  }

  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const redirectUri =
    process.env.AZURE_REDIRECT_URI?.trim() ??
    absoluteUrl('/api/signatures/ms-callback');

  if (!clientId) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.home}?signatures_error=${encodeURIComponent('Microsoft sign-in is not configured')}`,
      ),
    );
  }

  const oauthState = signSignaturesMsOAuthState({
    v: 2,
    accountId,
    slug: accountSlug,
    inviteId: null,
    flow: 'member',
    exp: Date.now() + 30 * 60_000,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope: SCOPES,
    state: oauthState,
  });

  return NextResponse.redirect(`${MS_AUTHORIZE}?${params.toString()}`);
}
