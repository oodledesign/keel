import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesStaffFilters } from '../../_components/signatures-staff-filters';
import { SignaturesStaffViews } from '../../_components/signatures-staff-views';
import {
  getFilterOptions,
  loadSignaturesWorkspace,
  loadStaffRows,
  loadTemplates,
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
  const [allStaff, staff, branches, templates] = await Promise.all([
    loadStaffRows(accountId),
    loadStaffRows(accountId, filters),
    loadAccountBranches(accountId),
    loadTemplates(accountId),
  ]);
  const options = getFilterOptions(allStaff);

  return (
    <div className="space-y-6">
      <ModuleDataSection
        title="Staff"
        description="Bulk-edit staff like a spreadsheet, or open the list to push individual signatures."
      >
        <SignaturesStaffFilters
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          departments={options.departments}
        />
      </ModuleDataSection>
      <SignaturesStaffViews
        accountId={accountId}
        accountSlug={account}
        staff={staff}
        templates={templates}
        branches={branches}
      />
    </div>
  );
}
