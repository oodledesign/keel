import { type NextRequest, NextResponse } from 'next/server';

import { decrypt } from '@kit/google-auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { listGscSites } from '~/lib/rankly-gsc/client';
import {
  loadGscConnection,
  saveGscConnection,
} from '~/lib/rankly-gsc/connection';
import { pickBestGscProperty } from '~/lib/rankly-gsc/domain';
import {
  exchangeGscCode,
  fetchGoogleAccountEmail,
  GSC_OAUTH_SCOPES,
  stateReturnPath,
  verifyGscState,
} from '~/lib/rankly-gsc/oauth';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  const stateToken = request.nextUrl.searchParams.get('state');
  const oauthError =
    request.nextUrl.searchParams.get('error_description') ??
    request.nextUrl.searchParams.get('error');

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const payload = stateToken ? verifyGscState(stateToken) : null;
  const returnPath = stateReturnPath(
    payload,
    pathsConfig.app.accountRanklyProjects.replace(
      '[account]',
      payload?.accountSlug ?? 'account',
    ),
  );
  const returnUrl = absoluteUrl(returnPath);

  if (!payload || payload.userId !== user.id) {
    return NextResponse.redirect(
      `${returnUrl}?gsc_error=${encodeURIComponent('Invalid or expired Google OAuth state')}`,
    );
  }

  if (oauthError) {
    return NextResponse.redirect(
      `${returnUrl}?gsc_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnUrl}?gsc_error=${encodeURIComponent('Missing Google authorization code')}`,
    );
  }

  try {
    const tokens = await exchangeGscCode(code);
    const googleEmail = await fetchGoogleAccountEmail(tokens.access_token);
    const existing = await loadGscConnection(client, payload.projectId);

    const { data: project } = await supabaseCustomSchema(client, 'rankly')
      .from('projects')
      .select('domain')
      .eq('id', payload.projectId)
      .eq('account_id', payload.accountId)
      .maybeSingle();

    let propertyUri = existing?.property_uri ?? null;
    if (!propertyUri && project?.domain) {
      const sites = await listGscSites(tokens.access_token);
      propertyUri = pickBestGscProperty(
        sites.map((site) => site.siteUrl),
        project.domain as string,
      );
    }

    const existingRefreshToken = existing?.refresh_token_encrypted
      ? decrypt(existing.refresh_token_encrypted)
      : null;

    await saveGscConnection(client, {
      projectId: payload.projectId,
      accountId: payload.accountId,
      connectedBy: user.id,
      googleEmail,
      tokens,
      scopes: [...GSC_OAUTH_SCOPES],
      existingRefreshToken,
      propertyUri,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Could not connect Google Search Console';
    return NextResponse.redirect(
      `${returnUrl}?gsc_error=${encodeURIComponent(message)}`,
    );
  }

  return NextResponse.redirect(`${returnUrl}?gsc_connected=1`);
}
