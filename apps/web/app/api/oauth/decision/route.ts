import { NextResponse } from 'next/server';

import { getMcpAppOrigin } from '@kit/ozer-mcp';
import { checkRequiresMultiFactorAuthentication } from '@kit/supabase/check-requires-mfa';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import {
  getOAuthDecisionRedirectUrl,
  isTrustedOAuthDecisionRequest,
  isUuidLikeAuthorizationId,
  logOAuthDecisionFailure,
  parseOAuthDecision,
  summarizeSupabaseAuthError,
  wantsJsonOAuthDecisionResponse,
} from '~/lib/oauth/decision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function consentPath(authorizationId?: string, error?: string) {
  const params = new URLSearchParams();
  if (authorizationId) {
    params.set('authorization_id', authorizationId);
  }
  if (error) {
    params.set('error', error);
  }

  const query = params.toString();
  return query ? `/oauth/consent?${query}` : '/oauth/consent';
}

function decisionResponse(
  request: Request,
  input: {
    status: number;
    error: string;
    redirectTo: string;
  },
) {
  if (wantsJsonOAuthDecisionResponse(request)) {
    return NextResponse.json({ error: input.error }, { status: input.status });
  }

  return NextResponse.redirect(new URL(input.redirectTo, request.url), 303);
}

export async function POST(request: Request) {
  const appOrigin = getMcpAppOrigin();
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    logOAuthDecisionFailure({
      reason: 'invalid_form',
      decision: null,
      authorizationIdPresent: false,
      authorizationIdLength: 0,
      authorizationIdUuid: false,
      hasRedirectUrl: false,
    });

    return decisionResponse(request, {
      status: 400,
      error: 'Invalid form data',
      redirectTo: consentPath(undefined, 'decision_failed'),
    });
  }

  const authorizationId =
    formData.get('authorization_id')?.toString().trim() ?? '';
  const decision = parseOAuthDecision(formData.get('decision')?.toString());
  const authorizationMeta = {
    authorizationIdPresent: Boolean(authorizationId),
    authorizationIdLength: authorizationId.length,
    authorizationIdUuid: isUuidLikeAuthorizationId(authorizationId),
  };

  if (!isTrustedOAuthDecisionRequest(request, appOrigin)) {
    logOAuthDecisionFailure({
      reason: 'untrusted_origin',
      decision,
      ...authorizationMeta,
      hasRedirectUrl: false,
    });

    return decisionResponse(request, {
      status: 403,
      error: 'Untrusted origin',
      redirectTo: consentPath(authorizationId || undefined, 'csrf'),
    });
  }

  if (!user) {
    const next = authorizationId
      ? consentPath(authorizationId)
      : pathsConfig.app.home;

    return NextResponse.redirect(
      new URL(
        `${pathsConfig.auth.signIn}?next=${encodeURIComponent(next)}`,
        request.url,
      ),
      303,
    );
  }

  try {
    const requiresMfa = await checkRequiresMultiFactorAuthentication(supabase);

    if (requiresMfa) {
      const next = authorizationId
        ? consentPath(authorizationId)
        : pathsConfig.app.home;

      return NextResponse.redirect(
        new URL(
          `${pathsConfig.auth.verifyMfa}?next=${encodeURIComponent(next)}`,
          request.url,
        ),
        303,
      );
    }
  } catch (error) {
    console.error('[oauth/decision] MFA check failed', {
      name: error instanceof Error ? error.name : null,
    });

    const next = authorizationId
      ? consentPath(authorizationId)
      : pathsConfig.app.home;

    return NextResponse.redirect(
      new URL(
        `${pathsConfig.auth.verifyMfa}?next=${encodeURIComponent(next)}`,
        request.url,
      ),
      303,
    );
  }

  if (!authorizationId) {
    logOAuthDecisionFailure({
      reason: 'missing_authorization_id',
      decision,
      ...authorizationMeta,
      hasRedirectUrl: false,
    });

    return decisionResponse(request, {
      status: 400,
      error: 'Missing authorization_id',
      redirectTo: consentPath(undefined, 'decision_failed'),
    });
  }

  if (!decision) {
    logOAuthDecisionFailure({
      reason: 'invalid_decision',
      decision: formData.get('decision')?.toString() ?? null,
      ...authorizationMeta,
      hasRedirectUrl: false,
    });

    return decisionResponse(request, {
      status: 400,
      error: 'Invalid decision',
      redirectTo: consentPath(authorizationId, 'decision_failed'),
    });
  }

  const result =
    decision === 'approve'
      ? await supabase.auth.oauth.approveAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        })
      : await supabase.auth.oauth.denyAuthorization(authorizationId, {
          skipBrowserRedirect: true,
        });

  const redirectUrl = getOAuthDecisionRedirectUrl(result.data);

  if (redirectUrl) {
    return NextResponse.redirect(redirectUrl, 303);
  }

  const details =
    await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  const recoveredRedirect = getOAuthDecisionRedirectUrl(details.data);

  if (recoveredRedirect) {
    logOAuthDecisionFailure({
      reason: 'already_processed',
      decision,
      ...authorizationMeta,
      supabase: summarizeSupabaseAuthError(result.error),
      hasRedirectUrl: true,
    });

    return NextResponse.redirect(recoveredRedirect, 303);
  }

  logOAuthDecisionFailure({
    reason: result.error ? 'supabase_error' : 'missing_redirect',
    decision,
    ...authorizationMeta,
    supabase: summarizeSupabaseAuthError(result.error ?? details.error),
    hasRedirectUrl: false,
  });

  return decisionResponse(request, {
    status: 400,
    error:
      result.error?.message ??
      details.error?.message ??
      'Failed to process consent decision',
    redirectTo: consentPath(authorizationId, 'decision_failed'),
  });
}
