import 'server-only';

import { cache } from 'react';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import {
  getCachedDisposalsListPage,
  getCachedUnassignedListingsCount,
} from '~/lib/cache/disposals-data-cache';
import { requireUserInServerComponent } from '~/lib/server/require-user-in-server-component';

import { loadTeamWorkspace } from '../../../_lib/server/team-account-workspace.loader';
import {
  COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  redirectIfSpaceNotIn,
} from '../../../_lib/server/workspace-route-guard';
import type { CommercialListing } from './listings.service';

export type DisposalsPageData = {
  accountId: string;
  accountSlug: string;
  userId: string;
  listings: CommercialListing[];
  total: number;
  offices: Array<{ id: string; name: string }>;
  initialOfficeId: string | null;
  unassignedCount: number;
};

async function loadDisposalsPageDataImpl(
  accountSlug: string,
  officeParam: string | null | undefined,
): Promise<DisposalsPageData> {
  const [workspace, user] = await Promise.all([
    loadTeamWorkspace(accountSlug),
    requireUserInServerComponent(),
  ]);

  redirectIfSpaceNotIn(
    workspace,
    accountSlug,
    COMMERCIAL_PROPERTY_WORKSPACE_SPACE_TYPES,
  );

  const accountId = workspace.account.id;
  if (!accountId) {
    throw new Error('Workspace account ID is missing');
  }

  const branches = await loadAccountBranches(accountId);
  const branchIds = new Set(branches.map((branch) => branch.id));
  const initialOfficeId =
    officeParam && branchIds.has(officeParam) ? officeParam : null;

  const [{ data: listings, total }, unassignedCount] = await Promise.all([
    getCachedDisposalsListPage({
      accountId,
      userId: user.id,
      accountBranchId: initialOfficeId,
      page: 1,
      pageSize: 20,
    }),
    branches.length > 1
      ? getCachedUnassignedListingsCount({ accountId })
      : Promise.resolve(0),
  ]);

  return {
    accountId,
    accountSlug: workspace.account.slug ?? accountSlug,
    userId: user.id,
    listings,
    total,
    offices: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
    })),
    initialOfficeId,
    unassignedCount,
  };
}

export const loadDisposalsPageData = cache(loadDisposalsPageDataImpl);
