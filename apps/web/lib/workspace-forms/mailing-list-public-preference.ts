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

export const PUBLIC_MAILING_PREFERENCE_INVALID_LINK =
  'This unsubscribe link is missing or invalid.';

export const PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED =
  'We could not update your email preference. Please try again.';

function throwMappedPreferenceError(err: unknown): never {
  throw new Error(PUBLIC_MAILING_PREFERENCE_UPDATE_FAILED, { cause: err });
}

export async function lookupMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  try {
    return (
      (await lookupWorkspaceMailingListByToken(admin, token)) ??
      (await lookupCampaignRecipientByToken(admin, token))
    );
  } catch (err) {
    throwMappedPreferenceError(err);
  }
}

export async function unsubscribeMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  try {
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
  } catch (err) {
    throwMappedPreferenceError(err);
  }
}

export async function resubscribeMailingListPublicPreference(
  admin: SupabaseClient,
  token: string,
): Promise<PublicMailingPreferenceResult | null> {
  try {
    return (
      (await resubscribeWorkspaceMailingListByToken(admin, token)) ??
      (await resubscribeCampaignRecipientByToken(admin, token))
    );
  } catch (err) {
    throwMappedPreferenceError(err);
  }
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
