import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

export const dynamic = 'force-dynamic';

const MS_ADMIN_CONSENT =
  'https://login.microsoftonline.com/common/adminconsent';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token')?.trim() ?? '';

  const invite = await loadIntegrationInviteByToken(token);
  if (!invite || invite.provider !== 'microsoft') {
    return NextResponse.redirect(
      absoluteUrl(
        `/connect/signatures/invalid?reason=${encodeURIComponent('This link is invalid or has expired')}`,
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
        `/connect/signatures/invalid?reason=${encodeURIComponent('Microsoft sign-in is not configured on Ozer')}`,
      ),
    );
  }

  const admin = getSupabaseServerAdminClient();
  const { data: account } = await admin
    .from('accounts')
    .select('slug, name')
    .eq('id', invite.account_id)
    .maybeSingle();

  const slug =
    typeof account?.slug === 'string' && account.slug.trim().length > 0
      ? account.slug.trim()
      : null;

  const oauthState = signSignaturesMsOAuthState({
    v: 2,
    accountId: invite.account_id,
    slug,
    inviteId: invite.id,
    flow: 'delegated_invite',
    exp: Date.now() + 30 * 60_000,
  });

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    state: oauthState,
  });

  return NextResponse.redirect(`${MS_ADMIN_CONSENT}?${params.toString()}`);
}
