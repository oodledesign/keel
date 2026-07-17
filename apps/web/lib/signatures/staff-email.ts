import 'server-only';

import type { StaffSource } from '~/lib/signatures/staff-source';
import { normalizeStaffEmail } from '~/lib/signatures/staff-source';

type SignaturesDb = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        ilike: (
          column: string,
          value: string,
        ) => {
          maybeSingle: () => Promise<{
            data: Record<string, unknown> | null;
            error: { message: string } | null;
          }>;
        };
      };
    };
  };
};

export async function findStaffByEmail(
  db: SignaturesDb,
  accountId: string,
  email: string,
): Promise<Record<string, unknown> | null> {
  const normalized = normalizeStaffEmail(email);
  const { data, error } = await db
    .from('staff')
    .select(
      'id, email, source, branch_id, signature_email, signature_status, ms_user_id, google_user_id',
    )
    .eq('account_id', accountId)
    .ilike('email', normalized)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data;
}

export function buildSyncConflictMessage(
  email: string,
  existingSource: StaffSource,
): string {
  return `${email} is already managed as a ${existingSource === 'manual' ? 'manual' : 'CSV'} entry and was not overwritten by directory sync.`;
}
