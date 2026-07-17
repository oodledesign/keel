import { type NextRequest, NextResponse } from 'next/server';

import { buildConsentUrl } from '@kit/google-auth';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import pathsConfig from '~/config/paths.config';
import { canUseEmailAssistant } from '~/lib/billing/entitlements';
import {
  EMAIL_ASSISTANT_DEFAULT_RETURN_PATH,
  GMAIL_OAUTH_SCOPES,
} from '~/lib/email-assistant/constants';
import { signGoogleOAuthState } from '~/lib/email-assistant/oauth-state';

export const dynamic = 'force-dynamic';

function absoluteUrl(path: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, '') ?? '';
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

export async function GET(request: NextRequest) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user) {
    return NextResponse.redirect(absoluteUrl(pathsConfig.auth.signIn));
  }

  const allowed = await canUseEmailAssistant(client, user.id);
  if (!allowed) {
    return NextResponse.redirect(
      absoluteUrl(
        `${pathsConfig.app.personalAccountBilling}?addon=email-assistant`,
      ),
    );
  }

  const returnPath =
    request.nextUrl.searchParams.get('returnPath') ??
    EMAIL_ASSISTANT_DEFAULT_RETURN_PATH;

  try {
    const state = signGoogleOAuthState({
      userId: user.id,
      returnPath,
      exp: Date.now() + 10 * 60_000,
    });

    return NextResponse.redirect(
      buildConsentUrl([...GMAIL_OAUTH_SCOPES], state),
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Google Gmail is not configured';

    return NextResponse.redirect(
      absoluteUrl(`${returnPath}?email_error=${encodeURIComponent(message)}`),
    );
  }
}
