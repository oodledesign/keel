'use client';

import type { SignatureStaff } from '../_lib/server/signatures-data';
import { SignaturesAddStaffButton } from './signatures-add-staff-dialog';
import { SignaturesStaffImportFlow } from './signatures-staff-import-flow';

type StaffImportRow = Pick<
  SignatureStaff,
  'id' | 'email' | 'source' | 'full_name'
>;

export function SignaturesStaffToolbar({
  accountId,
  accountSlug,
  staff,
}: {
  accountId: string;
  accountSlug: string;
  staff: StaffImportRow[];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <SignaturesAddStaffButton
        accountId={accountId}
        accountSlug={accountSlug}
      />
      <SignaturesStaffImportFlow
        accountId={accountId}
        existingStaff={staff.map((row) => ({
          id: row.id,
          email: row.email,
          source: row.source,
          full_name: row.full_name,
        }))}
      />
    </div>
  );
}
