import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type CommercialBoardSettings,
  parseCommercialBoardSettings,
  serializeCommercialBoardSettings,
} from '~/lib/commercial/board-company-settings';

/** Untyped until typegen includes commercial_board_settings. */
function fromAccounts(client: SupabaseClient) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (client as any).from('accounts');
}

export async function loadCommercialBoardSettings(
  client: SupabaseClient,
  accountId: string,
): Promise<CommercialBoardSettings> {
  const { data, error } = await fromAccounts(client)
    .select('commercial_board_settings')
    .eq('id', accountId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return parseCommercialBoardSettings(
    (data as { commercial_board_settings?: unknown } | null)
      ?.commercial_board_settings,
  );
}

export async function saveCommercialBoardSettings(
  client: SupabaseClient,
  accountId: string,
  settings: CommercialBoardSettings,
): Promise<CommercialBoardSettings> {
  const serialized = serializeCommercialBoardSettings(settings);

  const { error } = await fromAccounts(client)
    .update({ commercial_board_settings: serialized })
    .eq('id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  return serialized;
}
