import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesStaffFilters } from '../../_components/signatures-staff-filters';
import { SignaturesStaffTable } from '../../_components/signatures-staff-table';
import {
  getFilterOptions,
  loadSignaturesWorkspace,
  loadStaffRows,
} from '../../_lib/server/signatures-data';
import { loadAccountBranches } from '~/lib/brand/account-branches';

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
  const [allStaff, staff, branches] = await Promise.all([
    loadStaffRows(accountId),
    loadStaffRows(accountId, filters),
    loadAccountBranches(accountId),
  ]);
  const options = getFilterOptions(allStaff);

  return (
    <div className="space-y-6">
      <ModuleDataSection
        title="Staff"
        description="Review synced staff, assign a branch, and filter by location, department, or push status."
      >
        <SignaturesStaffFilters
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          departments={options.departments}
        />
      </ModuleDataSection>
      <SignaturesStaffTable accountSlug={account} staff={staff} />
    </div>
  );
}
