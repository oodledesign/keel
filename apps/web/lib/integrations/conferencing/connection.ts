import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { encryptConferencingSecret } from '@kit/scheduling/conferencing';

type DynamicTable = {
  upsert: (
    values: Record<string, unknown>,
    options?: Record<string, unknown>,
  ) => Promise<{ error: { message: string } | null }>;
  delete: () => {
    eq: (
      column: string,
      value: string,
    ) => {
      eq: (
        column: string,
        value: string,
      ) => Promise<{ error: { message: string } | null }>;
    };
  };
};

function table(client: SupabaseClient) {
  return (client as unknown as { from: (name: string) => DynamicTable }).from(
    'conferencing_connections',
  );
}

export async function saveConferencingConnection(
  client: SupabaseClient,
  input: {
    accountId: string;
    provider: 'zoom' | 'teams';
    accessToken: string;
    refreshToken: string | null;
    expiresIn?: number;
    providerAccountEmail: string | null;
  },
) {
  const expiresAt = input.expiresIn
    ? new Date(Date.now() + input.expiresIn * 1000).toISOString()
    : null;

  const { error } = await table(client).upsert(
    {
      account_id: input.accountId,
      provider: input.provider,
      access_token: encryptConferencingSecret(input.accessToken),
      refresh_token: input.refreshToken
        ? encryptConferencingSecret(input.refreshToken)
        : null,
      expires_at: expiresAt,
      provider_account_email: input.providerAccountEmail,
    },
    { onConflict: 'account_id,provider' },
  );

  if (error) {
    throw new Error(error.message);
  }
}

export async function deleteConferencingConnection(
  client: SupabaseClient,
  input: { accountId: string; provider: 'zoom' | 'teams' },
) {
  const { error } = await table(client)
    .delete()
    .eq('account_id', input.accountId)
    .eq('provider', input.provider);

  if (error) {
    throw new Error(error.message);
  }
}
