import { loadAccountBranches } from '~/lib/brand/account-branches';
import { countOpenChangeRequestsByStaff } from '~/lib/signatures/change-requests';

import { ModuleDataSection } from '../../../_components/module-data-section';
import { SignaturesStaffFilters } from '../../_components/signatures-staff-filters';
import { SignaturesStaffToolbar } from '../../_components/signatures-staff-toolbar';
import { SignaturesStaffViews } from '../../_components/signatures-staff-views';
import {
  type StaffListFilters,
  loadDepartments,
  loadSignaturesWorkspace,
  loadStaffImportRows,
  loadStaffPage,
  loadStaffRows,
  loadTemplates,
} from '../../_lib/server/signatures-data';
import {
  DEFAULT_SIGNATURES_STAFF_PAGE_SIZE,
  parseStaffListPage,
  parseStaffListPageSize,
} from '../../_lib/signatures-staff-pagination';

type SignaturesStaffPageProps = {
  params: Promise<{ account: string }>;
  searchParams: Promise<{
    branch?: string;
    department?: string;
    status?: string;
    q?: string;
    page?: string;
    pageSize?: string;
  }>;
};

function buildStaffFilters(
  searchParams: Awaited<SignaturesStaffPageProps['searchParams']>,
): StaffListFilters {
  return {
    branch: searchParams.branch ?? null,
    department: searchParams.department ?? null,
    status: searchParams.status ?? null,
    search: searchParams.q ?? null,
  };
}

export default async function SignaturesStaffPage({
  params,
  searchParams,
}: SignaturesStaffPageProps) {
  const { account } = await params;
  const query = await searchParams;
  const filters = buildStaffFilters(query);
  const page = parseStaffListPage(query.page);
  const pageSize = parseStaffListPageSize(
    query.pageSize,
    DEFAULT_SIGNATURES_STAFF_PAGE_SIZE,
  );

  const workspace = await loadSignaturesWorkspace(account);
  const accountId = workspace.account.id as string;

  const [
    importStaff,
    staffPage,
    bulkStaff,
    branches,
    departments,
    templates,
    openRequestCounts,
  ] = await Promise.all([
    loadStaffImportRows(accountId),
    loadStaffPage(accountId, { ...filters, page, pageSize }),
    loadStaffRows(accountId, filters),
    loadAccountBranches(accountId),
    loadDepartments(accountId),
    loadTemplates(accountId),
    countOpenChangeRequestsByStaff(accountId),
  ]);

  const openRequestCountsRecord = Object.fromEntries(openRequestCounts);

  return (
    <div className="space-y-6">
      <ModuleDataSection
        title="Staff"
        description="Bulk-edit staff like a spreadsheet, add people manually, or import from CSV."
      >
        <SignaturesStaffToolbar
          accountId={accountId}
          accountSlug={account}
          staff={importStaff}
        />
        <SignaturesStaffFilters
          branches={branches.map((b) => ({ id: b.id, name: b.name }))}
          departments={departments}
        />
      </ModuleDataSection>
      <SignaturesStaffViews
        accountId={accountId}
        accountSlug={account}
        staff={staffPage.rows}
        bulkStaff={bulkStaff}
        templates={templates}
        branches={branches}
        openRequestCounts={openRequestCountsRecord}
        page={staffPage.page}
        pageSize={staffPage.pageSize}
        totalCount={staffPage.totalCount}
      />
    </div>
  );
}
