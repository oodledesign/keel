import { type NextRequest, NextResponse } from 'next/server';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { assertAccountAdmin } from '~/lib/signatures/account-access';
import { denyUnlessSignaturesAddon } from '~/lib/signatures/require-signatures-api-access';
import {
  loadIntegrationInviteById,
  markIntegrationInviteUsed,
} from '~/lib/signatures/integration-invite';
import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';
import { decodeMsOAuthState } from '~/lib/signatures/ms-oauth-state';
import {
  signSignaturesMsOAuthState,
  verifySignaturesMsOAuthState,
} from '~/lib/signatures/signatures-oauth-state';

export const dynamic = 'force-dynamic';

const MS_TOKEN =
  'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split('.');
    const payload = parts[1];
    if (!payload) return null;
    const padded = payload.replace(/-/g, '+').replace(/_/g, '/');
    const json = Buffer.from(padded, 'base64').toString('utf8');
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function resolveSettingsPath(slug: string | null, accountId: string) {
  if (slug) {
    return `${pathsConfig.app.accountSignaturesSettings}`.replace(
      '[account]',
      slug,
    );
  }
  return pathsConfig.app.home;
}

async function resolveSlug(accountId: string, slug: string | null) {
  if (slug) return slug;
  const client = getSupabaseServerClient();
  const { data: accountRow } = await client
    .from('accounts')
    .select('slug')
    .eq('id', accountId)
    .maybeSingle();
  const resolved =
    typeof accountRow?.slug === 'string' ? accountRow.slug.trim() : '';
  return resolved.length > 0 ? resolved : null;
}

async function persistMicrosoftTenant(input: {
  accountId: string;
  msTenantId: string;
  connectedBy: string | null;
  accessToken?: string | null;
  refreshToken?: string | null;
  tokenExpiresAt?: string | null;
}) {
  const db = getSignaturesSupabaseClient();
  const { error: upErr } = await db.from('ms_connections').upsert(
    {
      account_id: input.accountId,
      ms_tenant_id: input.msTenantId,
      access_token: input.accessToken ?? null,
      refresh_token: input.refreshToken ?? null,
      token_expires_at: input.tokenExpiresAt ?? null,
      connected_by: input.connectedBy,
    },
    { onConflict: 'account_id' },
  );

  if (upErr) {
    throw new Error(upErr.message);
  }
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const code = url.searchParams.get('code');
  const stateRaw = url.searchParams.get('state');
  const oauthError =
    url.searchParams.get('error_description') ?? url.searchParams.get('error');
  const adminConsent = url.searchParams.get('admin_consent');
  const adminTenant = url.searchParams.get('tenant');

  const signedState = stateRaw
    ? verifySignaturesMsOAuthState(stateRaw)
    : null;
  const legacyState = !signedState ? decodeMsOAuthState(stateRaw) : null;
  const accountId = signedState?.accountId ?? legacyState?.accountId ?? null;
  const slug = await resolveSlug(
    accountId ?? '',
    signedState?.slug ?? legacyState?.slug ?? null,
  );

  const fallbackHome = absoluteUrl(pathsConfig.app.home);
  const settingsPath = accountId
    ? resolveSettingsPath(slug, accountId)
    : pathsConfig.app.home;
  const returnBase = absoluteUrl(settingsPath);

  if (!accountId?.match(/^[0-9a-f-]{36}$/i)) {
    return NextResponse.redirect(
      `${fallbackHome}?signatures_error=${encodeURIComponent('Invalid OAuth state')}`,
    );
  }

  const isDelegatedInvite = signedState?.flow === 'delegated_invite';

  if (oauthError) {
    if (isDelegatedInvite) {
      return NextResponse.redirect(
        absoluteUrl(
          `/connect/signatures/error?message=${encodeURIComponent(oauthError)}`,
        ),
      );
    }
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent(oauthError)}`,
    );
  }

  if (isDelegatedInvite) {
    if (adminConsent === 'True' && adminTenant?.match(/^[0-9a-f-]{36}$/i)) {
      const invite = signedState.inviteId
        ? await loadIntegrationInviteById(signedState.inviteId)
        : null;

      if (!invite || invite.account_id !== accountId) {
        return NextResponse.redirect(
          absoluteUrl(
            `/connect/signatures/invalid?reason=${encodeURIComponent('This integration link is no longer valid')}`,
          ),
        );
      }

      try {
        await persistMicrosoftTenant({
          accountId,
          msTenantId: adminTenant,
          connectedBy: null,
        });
        await markIntegrationInviteUsed({
          inviteId: invite.id,
          accountId,
        });
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'Microsoft connect failed';
        return NextResponse.redirect(
          absoluteUrl(`/connect/signatures/error?message=${encodeURIComponent(msg)}`),
        );
      }

      return NextResponse.redirect(
        absoluteUrl('/connect/signatures/success?provider=microsoft'),
      );
    }

    return NextResponse.redirect(
      absoluteUrl(
        `/connect/signatures/invalid?reason=${encodeURIComponent('Microsoft admin consent was not completed')}`,
      ),
    );
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const forbidden = await assertAccountAdmin(client, accountId, user.id);
  if (forbidden) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Account admin required')}`,
    );
  }

  const addonDenied = await denyUnlessSignaturesAddon(client, user.id, accountId);
  if (addonDenied) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Signatures add-on required')}`,
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Missing authorization code')}`,
    );
  }

  const clientId = process.env.AZURE_CLIENT_ID?.trim();
  const clientSecret =
    process.env.AZURE_CLIENT_SECRET?.trim() ||
    process.env.AZURE_SECRET_VALUE?.trim();
  const redirectUri =
    process.env.AZURE_REDIRECT_URI?.trim() ??
    absoluteUrl('/api/signatures/ms-callback');

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent('Microsoft OAuth is not configured')}`,
    );
  }

  try {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    });

    const tokenRes = await fetch(MS_TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
      error?: string;
      error_description?: string;
    };

    if (
      !tokenRes.ok ||
      !tokenJson.access_token ||
      typeof tokenJson.access_token !== 'string'
    ) {
      const msg =
        tokenJson.error_description ??
        tokenJson.error ??
        'Token exchange failed';
      throw new Error(msg);
    }

    const claims = decodeJwtPayload(tokenJson.access_token);
    const tid = claims?.tid;
    const msTenantId =
      typeof tid === 'string' && tid.length > 0 ? tid : null;

    if (!msTenantId) {
      throw new Error('Could not read tenant id from token');
    }

    const expiresIn = tokenJson.expires_in ?? 3600;
    const tokenExpiresAt = new Date(
      Date.now() + Math.max(60, expiresIn) * 1000,
    ).toISOString();

    await persistMicrosoftTenant({
      accountId,
      msTenantId,
      connectedBy: user.id,
      accessToken: tokenJson.access_token,
      refreshToken: tokenJson.refresh_token ?? null,
      tokenExpiresAt,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Microsoft connect failed';
    return NextResponse.redirect(
      `${returnBase}?signatures_error=${encodeURIComponent(msg)}`,
    );
  }

  return NextResponse.redirect(`${returnBase}?connected=true`);
}
