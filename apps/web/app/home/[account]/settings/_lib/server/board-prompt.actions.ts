'use server';

import { enhanceAction } from '@kit/next/actions';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import {
  loadCommercialBoardSettings,
  saveCommercialBoardSettings,
} from '~/lib/commercial/board-company-settings.server';
import { requireCommercialBillableActor } from '~/lib/commercial/require-commercial-billable-actor';

import { SaveBoardPromptPreferencesSchema } from '../../../listings/_lib/schema/board-notify.schema';

/**
 * Turn the "Notify board company?" prompt on or off for the workspace, or
 * for individual offices. Other board settings are left as saved.
 */
export const saveBoardPromptPreferencesAction = enhanceAction(
  async (input) => {
    await requireCommercialBillableActor(
      input.accountId,
      'change board company prompt settings',
    );

    const client = getSupabaseServerClient();

    // Saving uses the admin client, so confirm the caller can see this
    // workspace first (RLS only returns accounts they belong to).
    const { data: visible } = await client
      .from('accounts')
      .select('id')
      .eq('id', input.accountId)
      .maybeSingle();
    if (!visible) throw new Error('Workspace not found');

    const [current, branches] = await Promise.all([
      loadCommercialBoardSettings(client, input.accountId),
      loadAccountBranches(input.accountId),
    ]);

    // Only this workspace's offices can be switched off.
    const knownBranchIds = new Set(branches.map((b) => b.id));
    const saved = await saveCommercialBoardSettings(client, input.accountId, {
      ...current,
      promptEnabled: input.promptEnabled,
      promptOffBranchIds: input.promptOffBranchIds.filter((id) =>
        knownBranchIds.has(id),
      ),
    });

    return {
      promptEnabled: saved.promptEnabled,
      promptOffBranchIds: saved.promptOffBranchIds,
    };
  },
  { schema: SaveBoardPromptPreferencesSchema },
);
