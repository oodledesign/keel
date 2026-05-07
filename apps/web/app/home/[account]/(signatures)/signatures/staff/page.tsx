import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesStaffFilters } from '../../_components/signatures-staff-filters';
import { SignaturesStaffTable } from '../../_components/signatures-staff-table';
import {
  getFilterOptions,
  loadSignaturesWorkspace,
  loadStaffRows,
} from '../../_lib/server/signatures-data';

type SignaturesStaffPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    branch?: string;
    department?: string;
    status?: string;
  }>;
};

export default async function SignaturesStaffPage({
  params,
  searchParams,
}: SignaturesStaffPageProps) {
  const { account } = await params;
  const filters = await searchParams;
  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;
  const [allStaff, staff] = await Promise.all([
    loadStaffRows(accountId),
    loadStaffRows(accountId, filters),
  ]);
  const options = getFilterOptions(allStaff);

  return (
    <div className="space-y-6">
      <ModuleDataSection
        title="Staff"
        description="Review synced Microsoft 365 staff and filter by branch, department, or push status."
      >
        <SignaturesStaffFilters
          branches={options.branches}
          departments={options.departments}
        />
      </ModuleDataSection>
      <SignaturesStaffTable accountSlug={account} staff={staff} />
    </div>
  );
}
