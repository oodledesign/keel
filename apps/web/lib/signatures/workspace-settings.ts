import 'server-only';

import { getSignaturesSupabaseClient } from '~/lib/signatures/graph';

export type SignaturesWorkspaceSettings = {
  account_id: string;
  manual_mode_enabled: boolean;
  company_logo_url: string | null;
  company_icon_url: string | null;
};

const EMPTY_SETTINGS = {
  manual_mode_enabled: false,
  company_logo_url: null as string | null,
  company_icon_url: null as string | null,
};

/**
 * Whether this workspace opted into manual / self-install Signatures
 * (no Microsoft 365 or Google Workspace connection required).
 */
export async function isSignaturesManualModeEnabled(
  accountId: string,
): Promise<boolean> {
  const settings = await loadSignaturesWorkspaceSettings(accountId);
  return settings.manual_mode_enabled;
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

export async function loadSignaturesWorkspaceSettings(
  accountId: string,
): Promise<Omit<SignaturesWorkspaceSettings, 'account_id'>> {
  const db = getSignaturesSupabaseClient();
  const { data, error } = await db
    .from('workspace_settings')
    .select('manual_mode_enabled, company_logo_url, company_icon_url')
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) {
    console.error(
      '[signatures] load workspace_settings failed:',
      error.message,
    );
    return { ...EMPTY_SETTINGS };
  }

  const row = data as {
    manual_mode_enabled?: boolean;
    company_logo_url?: string | null;
    company_icon_url?: string | null;
  } | null;

  return {
    manual_mode_enabled: Boolean(row?.manual_mode_enabled),
    company_logo_url: row?.company_logo_url?.trim() || null,
    company_icon_url: row?.company_icon_url?.trim() || null,
  };
}

export async function updateSignaturesCompanyAssetUrls(
  accountId: string,
  patch: {
    company_logo_url?: string | null;
    company_icon_url?: string | null;
  },
): Promise<void> {
  const db = getSignaturesSupabaseClient();

  // Ensure the row exists without clobbering other columns.
  const { error: ensureError } = await db.from('workspace_settings').upsert(
    { account_id: accountId },
    { onConflict: 'account_id', ignoreDuplicates: true },
  );

  if (ensureError) {
    throw new Error(
      ensureError.message || 'Failed to ensure Signatures workspace settings',
    );
  }

  const updatePayload: {
    company_logo_url?: string | null;
    company_icon_url?: string | null;
  } = {};

  if (patch.company_logo_url !== undefined) {
    updatePayload.company_logo_url = patch.company_logo_url;
  }
  if (patch.company_icon_url !== undefined) {
    updatePayload.company_icon_url = patch.company_icon_url;
  }

  if (Object.keys(updatePayload).length === 0) {
    return;
  }

  const { error } = await db
    .from('workspace_settings')
    .update(updatePayload)
    .eq('account_id', accountId);

  if (error) {
    throw new Error(
      error.message || 'Failed to update Signatures company assets',
    );
  }
}
