import 'server-only';

import { createHash, randomBytes } from 'node:crypto';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { createApiToken } from '~/lib/api-tokens/api-tokens.service';
import { getPersonalAccountId } from '~/lib/recorder/personal-account';

const DESKTOP_CONNECT_SCHEME = 'keelassistant';
const CODE_TTL_MS = 2 * 60 * 1000;

function connectCodesTable(admin: ReturnType<typeof getSupabaseServerAdminClient>) {
  return admin.from('recorder_connect_codes');
}

function hashConnectCode(code: string) {
  return createHash('sha256').update(code.trim()).digest('hex');
}

export function buildDesktopConnectRedirectURL(input: {
  code: string;
  state: string;
}) {
  const params = new URLSearchParams({
    code: input.code,
    state: input.state,
  });
  return `${DESKTOP_CONNECT_SCHEME}://connect?${params.toString()}`;
}

export async function createDesktopConnectSession(input: {
  userId: string;
  state: string;
}) {
  const state = input.state.trim();
  if (!state || state.length > 128) {
    throw new Error('Invalid connect state');
  }

  const client = getSupabaseServerAdminClient();
  const personalAccountId = await getPersonalAccountId(client, input.userId);
  if (!personalAccountId) {
    throw new Error('Personal account not found');
  }

  const { rawToken } = await createApiToken({
    accountId: personalAccountId,
    userId: input.userId,
    name: 'Keel Assistant (Mac)',
  });

  const code = randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

  const { error } = await connectCodesTable(client).insert({
    code_hash: hashConnectCode(code),
    user_id: input.userId,
    state,
    raw_token: rawToken,
    expires_at: expiresAt,
  });

  if (error) {
    throw new Error(error.message);
  }

  return {
    code,
    redirectURL: buildDesktopConnectRedirectURL({ code, state }),
  };
}

export async function exchangeDesktopConnectCode(input: {
  code: string;
  state: string;
}) {
  const code = input.code.trim();
  const state = input.state.trim();
  if (!code || !state) {
    return null;
  }

  const admin = getSupabaseServerAdminClient();
  const codeHash = hashConnectCode(code);
  const now = new Date().toISOString();

  const { data, error } = await connectCodesTable(admin)
    .select('id, raw_token, state, expires_at, used_at')
    .eq('code_hash', codeHash)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  const row = data as {
    id: string;
    raw_token: string;
    state: string;
    expires_at: string;
    used_at: string | null;
  };

  if (row.used_at || row.expires_at <= now || row.state !== state) {
    return null;
  }

  const { error: updateError } = await connectCodesTable(admin)
    .update({ used_at: now })
    .eq('id', row.id)
    .is('used_at', null);

  if (updateError) {
    return null;
  }

  return row.raw_token;
}
