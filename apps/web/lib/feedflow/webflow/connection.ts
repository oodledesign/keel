import 'server-only';

import { encryptSecret } from '~/lib/feedflow/crypto-tokens';
import { supabaseCustomSchema } from '~/lib/supabase-custom-schema';

import { listWebflowSites } from './client';

/**
 * Validates a Webflow token and stores it (encrypted) on the workspace's or
 * client's single connection, creating the connection if needed.
 */
export async function saveWebflowConnectionToken(
  client: unknown,
  input: { accountId: string; clientId: string | null; token: string },
): Promise<{ connectionId: string }> {
  const sites = await listWebflowSites(input.token);
  if (sites.length === 0) {
    throw new Error('This Webflow connection cannot see any sites');
  }

  const feed = supabaseCustomSchema(client, 'feedflow');
  const encrypted = encryptSecret(input.token);

  let existing = feed
    .from('webflow_connections')
    .select('id')
    .eq('account_id', input.accountId);
  existing = input.clientId
    ? existing.eq('client_id', input.clientId)
    : existing.is('client_id', null);
  const { data: found } = await existing.maybeSingle();

  if (found?.id) {
    const { error } = await feed
      .from('webflow_connections')
      .update({ webflow_api_token: encrypted, sync_error: null })
      .eq('id', found.id)
      .eq('account_id', input.accountId);
    if (error) throw new Error(error.message);
    return { connectionId: found.id as string };
  }

  const { data, error } = await feed
    .from('webflow_connections')
    .insert({
      account_id: input.accountId,
      client_id: input.clientId,
      webflow_api_token: encrypted,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { connectionId: data.id as string };
}
