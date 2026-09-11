import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { markCampaignRecipientsUnsubscribed } from '~/lib/campaigns/campaigns.service';
import {
  lookupCampaignRecipientByToken,
  resubscribeCampaignRecipientByToken,
  unsubscribeCampaignRecipientByToken,
} from '~/lib/campaigns/resolve-campaign-audience';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import {
  type PublicMailingPreferenceResult,
  lookupWorkspaceMailingListByToken,
  resubscribeWorkspaceMailingListByToken,
  unsubscribeWorkspaceMailingListByToken,
} from '~/lib/workspace-forms/workspace-mailing-list';

export type { PublicMailingPreferenceResult };

export async function lookupMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  return (
    (await lookupWorkspaceMailingListByToken(admin, token)) ??
    (await lookupCampaignRecipientByToken(admin, token))
  );
}

export async function unsubscribeMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  const result =
    (await unsubscribeWorkspaceMailingListByToken(admin, token)) ??
    (await unsubscribeCampaignRecipientByToken(admin, token));

  if (!result) return null;

  if (result.marketingStatus !== 'suppressed') {
    await markCampaignRecipientsUnsubscribed(
      admin,
      result.accountId,
      result.email,
    );

    try {
      await createCommercialCirculationService(admin).unsubscribe(
        result.accountId,
        result.email,
      );
    } catch {
      // Business workspaces have no circulation rows; ignore.
    }
  }

  return result;
}

export async function resubscribeMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  const result =
    (await resubscribeWorkspaceMailingListByToken(admin, token)) ??
    (await resubscribeCampaignRecipientByToken(admin, token));

  if (!result) return null;

  if (result.marketingStatus !== 'suppressed') {
    try {
      await createCommercialCirculationService(admin).resubscribe(
        result.accountId,
        result.email,
        { consentSource: 'unsubscribe_page_resubscribe' },
      );
    } catch {
      // Business workspaces have no circulation rows; ignore.
    }
  }

  return result;
}

export async function loadWorkspaceNameForPreference(
  admin: SupabaseClient,
  accountId: string,
): Promise<string> {
  const { data: account } = await admin
    .from('accounts')
    .select('name')
    .eq('id', accountId)
    .maybeSingle();

  return (
    (account as { name?: string | null } | null)?.name?.trim() ||
    'this workspace'
  );
}
