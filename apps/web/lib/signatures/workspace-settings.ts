import 'server-only';

import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';

/**
 * Whether this workspace opted into manual / self-install Signatures
 * (no Microsoft 365 or Google Workspace connection required).
 */
export async function isSignaturesManualModeEnabled(
  accountId: string,
): Promise<boolean> {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('workspace_settings')
    .select('manual_mode_enabled')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error(
      '[signatures] load workspace_settings failed:',
      error.message,
    );
    return false;
  }

  return Boolean(
    (data as { manual_mode_enabled?: boolean } | null)?.manual_mode_enabled,
  );
}

/** Persist manual mode so the connection gate stays unlocked across refreshes. */
export async function enableSignaturesManualMode(
  accountId: string,
): Promise<void> {
  const db = getSignaturesSupabaseClient();
  const { error } = await db.from('workspace_settings').upsert(
    {
      account_id: accountId,
      manual_mode_enabled: true,
    },
    { onConflict: 'account_id' },
  );

  if (error) {
    throw new Error(error.message || 'Failed to enable Signatures manual mode');
  }
}
