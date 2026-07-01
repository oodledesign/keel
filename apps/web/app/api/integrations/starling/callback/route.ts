import { redirect } from 'next/navigation';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  encryptGoogleSecret,
} from '~/lib/integrations/google-calendar/crypto';
import {
  exchangeStarlingCode,
  verifyStarlingState,
} from '~/lib/integrations/starling/oauth';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  if (!state) {
    return redirect('/app?finance_error=missing_state');
  }

  let payload;
  try {
    payload = verifyStarlingState(state);
  } catch {
    return redirect('/app?finance_error=invalid_state');
  }

  const returnUrl = payload.returnPath;

  if (error || !code) {
    return redirect(`${returnUrl}?finance_error=${encodeURIComponent(error ?? 'denied')}`);
  }

  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();

  if (!user || user.id !== payload.userId) {
    return redirect(`${returnUrl}?finance_error=unauthorized`);
  }

  try {
    const tokens = await exchangeStarlingCode(code);
    const expiresAt = new Date(Date.now() + tokens.expires_in * 1000);

    const { error: upsertError } = await client.from('finance_connections').upsert(
      {
        account_id: payload.accountId,
        provider: 'starling',
        access_token: null,
        refresh_token: null,
        access_token_encrypted: encryptGoogleSecret(tokens.access_token),
        refresh_token_encrypted: encryptGoogleSecret(tokens.refresh_token),
        token_expires_at: expiresAt.toISOString(),
        connected_by: user.id,
        sync_state: { scope: tokens.scope ?? null },
      } as never,
      { onConflict: 'account_id,provider' },
    );

    if (upsertError) throw upsertError;

    return redirect(`${returnUrl}?finance_connected=starling`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'oauth_failed';
    return redirect(`${returnUrl}?finance_error=${encodeURIComponent(msg)}`);
  }
}
