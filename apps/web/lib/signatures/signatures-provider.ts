import 'server-only';

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

export type SignaturesMailProvider = 'google' | 'microsoft' | null;

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

  if (provider === 'google') {
    return syncStaffFromGoogleWorkspace(accountId);
  }
  if (provider === 'microsoft') {
    return syncStaffFromM365(accountId);
  }

  throw new Error(
    'Connect Microsoft 365 or Google Workspace in Signatures settings first',
  );
}

export async function pushSignatureToStaff(
  staffId: string,
): Promise<{ success: boolean; error?: string }> {
  const db = getSignaturesSupabaseClient();
  const { data: staff } = await db
    .from('staff')
    .select('account_id')
    .eq('id', staffId)
    .maybeSingle();

  if (!staff?.account_id) {
    return { success: false, error: 'Staff not found' };
  }

  const provider = await getSignaturesMailProvider(staff.account_id as string);

  if (provider === 'google') {
    return pushSignatureToGoogleStaff(staffId);
  }
  if (provider === 'microsoft') {
    return pushMicrosoftSignature(staffId);
  }

  return { success: false, error: 'No mail provider connected for this workspace' };
}

export async function pushAllSignatures(
  accountId: string,
  pushedBy: string,
): Promise<{ total: number; succeeded: number; failed: number }> {
  const provider = await getSignaturesMailProvider(accountId);

  if (provider === 'microsoft') {
    return pushAllMicrosoftSignatures(accountId, pushedBy);
  }

  const db = getSignaturesSupabaseClient();
  const { data: rows, error } = await db
    .from('staff')
    .select('id')
    .eq('account_id', accountId);

  if (error) {
    throw new Error(error.message);
  }

  const ids = (rows ?? []).map((r) => r.id as string);
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

  return { total: ids.length, succeeded, failed };
}
