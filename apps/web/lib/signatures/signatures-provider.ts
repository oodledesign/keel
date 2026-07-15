import 'server-only';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { findPlanByProductAndPlanId } from '~/lib/billing/ozer-plan-catalog';

import {
  loadGoogleConnection,
  pushSignatureToGoogleStaff,
  syncStaffFromGoogleWorkspace,
} from './google-workspace';
import {
  getSignaturesSupabaseClient,
  pushAllSignatures as pushAllMicrosoftSignatures,
  pushSignatureToStaff as pushMicrosoftSignature,
  syncStaffFromM365,
} from './graph';
import { sendSignatureSyncCompletedEmail } from './sync-notifications';

export type SignaturesMailProvider = 'google' | 'microsoft' | null;

export type SignaturesTierWarning = {
  warning?: string;
};

export async function getSignaturesMailProvider(
  accountId: string,
): Promise<SignaturesMailProvider> {
  const google = await loadGoogleConnection(accountId);
  if (google) {
    return 'google';
  }

  const db = getSignaturesSupabaseClient();
  const { data } = await db
    .from('ms_connections')
    .select('id')
    .eq('account_id', accountId)
    .maybeSingle();

  return data ? 'microsoft' : null;
}

export async function isSignaturesMailConnected(
  accountId: string,
): Promise<boolean> {
  return (await getSignaturesMailProvider(accountId)) !== null;
}

export async function syncStaffForAccount(
  accountId: string,
): Promise<{ synced: number; errors: string[] }> {
  const provider = await getSignaturesMailProvider(accountId);

  if (provider !== 'google' && provider !== 'microsoft') {
    throw new Error(
      'Connect Microsoft 365 or Google Workspace in Signatures settings first',
    );
  }

  const result =
    provider === 'google'
      ? await syncStaffFromGoogleWorkspace(accountId)
      : await syncStaffFromM365(accountId);

  // Confirmation to workspace owners/admins; fire-and-forget — the
  // notification never throws and must not delay the sync response.
  void sendSignatureSyncCompletedEmail({
    accountId,
    provider,
    synced: result.synced,
    errors: result.errors,
  });

  return result;
}

export async function pushSignatureToStaff(
  staffId: string,
): Promise<{ success: boolean; error?: string } & SignaturesTierWarning> {
  const db = getSignaturesSupabaseClient();
  const { data: staff } = await db
    .from('staff')
    .select('account_id')
    .eq('id', staffId)
    .maybeSingle();

  if (!staff?.account_id) {
    return { success: false, error: 'Staff not found' };
  }

  const accountId = staff.account_id as string;
  const provider = await getSignaturesMailProvider(accountId);
  const warning = await loadSignatureTierWarning(accountId);

  if (provider === 'google') {
    const result = await pushSignatureToGoogleStaff(staffId);
    return { ...result, warning };
  }
  if (provider === 'microsoft') {
    const result = await pushMicrosoftSignature(staffId);
    return { ...result, warning };
  }

  return {
    success: false,
    error: 'No mail provider connected for this workspace',
  };
}

export async function pushAllSignatures(
  accountId: string,
  pushedBy: string,
): Promise<
  { total: number; succeeded: number; failed: number } & SignaturesTierWarning
> {
  const provider = await getSignaturesMailProvider(accountId);
  const warning = await loadSignatureTierWarning(accountId);

  if (provider === 'microsoft') {
    const summary = await pushAllMicrosoftSignatures(accountId, pushedBy);
    return { ...summary, warning };
  }

  const db = getSignaturesSupabaseClient();
  const { data: rows, error } = await db
    .from('staff')
    .select('id')
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  const ids = ((rows ?? []) as Array<{ id: string }>).map((row) => row.id);
  let succeeded = 0;
  let failed = 0;

  for (const id of ids) {
    try {
      const result = await pushSignatureToGoogleStaff(id, pushedBy);
      if (result.success) {
        succeeded += 1;
      } else {
        failed += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return { total: ids.length, succeeded, failed, warning };
}

async function loadSignatureTierWarning(
  accountId: string,
): Promise<string | undefined> {
  const mailboxCount = await countSignatureMailboxes(accountId);
  const maxMailboxes = await loadSignatureMailboxLimit(accountId);

  if (!maxMailboxes || mailboxCount <= maxMailboxes) {
    return undefined;
  }

  return `This workspace has ${mailboxCount} mailboxes, above the current Signatures tier limit of ${maxMailboxes}. Deployment will continue, but prompt the workspace owner to move up before the next billing cycle.`;
}

async function countSignatureMailboxes(accountId: string): Promise<number> {
  const db = getSignaturesSupabaseClient();
  const { count, error } = await db
    .from('staff')
    .select('id', { count: 'exact', head: true })
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  return count ?? 0;
}

async function loadSignatureMailboxLimit(
  accountId: string,
): Promise<number | null> {
  const admin = getSupabaseServerAdminClient();
  const { data, error } = await admin
    .from('account_entitlements')
    .select('metadata')
    .eq('account_id', accountId)
    .eq('entitlement_key', 'addon_signatures')
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const metadata = data?.metadata as
    | {
        productId?: string;
        planId?: string;
        limits?: { maxMailboxes?: number | null };
      }
    | null
    | undefined;

  if (typeof metadata?.limits?.maxMailboxes === 'number') {
    return metadata.limits.maxMailboxes;
  }

  if (!metadata?.productId || !metadata.planId) {
    return null;
  }

  const plan = findPlanByProductAndPlanId(metadata.productId, metadata.planId);
  return plan?.limits.maxMailboxes ?? null;
}
