import 'server-only';

import { cache } from 'react';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

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
import {
  type DisposalStatusFilter,
  disposalStatusQueryParams,
  parseDisposalStatusFilter,
} from '../disposal-list-filters';
import type {
  CommercialListing,
  ListingMemberOption,
} from './listings.service';
import { createListingsService } from './listings.service';

export type DisposalsPageFilters = {
  office?: string | null;
  status?: string | null;
  agent?: string | null;
};

export type DisposalsPageData = {
  accountId: string;
  accountSlug: string;
  userId: string;
  listings: CommercialListing[];
  total: number;
  offices: Array<{ id: string; name: string }>;
  members: ListingMemberOption[];
  initialOfficeId: string | null;
  initialStatusFilter: DisposalStatusFilter;
  initialAgentUserId: string | null;
  unassignedCount: number;
  canEditDisposals: boolean;
};

async function loadDisposalsPageDataImpl(
  accountSlug: string,
  filters: DisposalsPageFilters = {},
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

  const resolvedSlug = workspace.account.slug ?? accountSlug;
  const client = getSupabaseServerClient();
  const listingsService = createListingsService(client);

  const initialStatusFilter = parseDisposalStatusFilter(filters.status);
  const { status, statuses } = disposalStatusQueryParams(initialStatusFilter);

  // Default (unfiltered) list can start with branches/members — most refreshes.
  const loadDefaultList = !filters.office && !filters.agent;
  const [branches, members, defaultPage] = await Promise.all([
    loadAccountBranches(accountId),
    listingsService.listAccountMembers(resolvedSlug),
    loadDefaultList
      ? getCachedDisposalsListPage({
          accountId,
          userId: user.id,
          accountBranchId: null,
          status,
          statuses,
          actingAgentUserId: null,
          page: 1,
          pageSize: 20,
        })
      : Promise.resolve(null),
  ]);

  const branchIds = new Set(branches.map((branch) => branch.id));
  const initialOfficeId =
    filters.office && branchIds.has(filters.office) ? filters.office : null;
  const memberIds = new Set(members.map((member) => member.userId));
  const initialAgentUserId =
    filters.agent && memberIds.has(filters.agent) ? filters.agent : null;

  const [{ data: listings, total }, unassignedCount] = await Promise.all([
    defaultPage ??
      getCachedDisposalsListPage({
        accountId,
        userId: user.id,
        accountBranchId: initialOfficeId,
        status,
        statuses,
        actingAgentUserId: initialAgentUserId,
        page: 1,
        pageSize: 20,
      }),
    branches.length > 1
      ? getCachedUnassignedListingsCount({
          accountId,
          status,
          statuses,
        })
      : Promise.resolve(0),
  ]);

  const canEditDisposals = workspace.canMutateCommercial;

  return {
    accountId,
    accountSlug: resolvedSlug,
    userId: user.id,
    listings,
    total,
    offices: branches.map((branch) => ({
      id: branch.id,
      name: branch.name,
    })),
    members,
    initialOfficeId,
    initialStatusFilter,
    initialAgentUserId,
    unassignedCount,
    canEditDisposals,
  };
}

export const loadDisposalsPageData = cache(loadDisposalsPageDataImpl);
