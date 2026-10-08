import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { createListingsService } from '~/home/[account]/listings/_lib/server/listings.service';
import { revalidateDisposalsCaches } from '~/lib/cache/disposals-data-cache';
import { canCommercialMutateDisposals } from '~/lib/commercial/commercial-seat-access';

import {
  type NativeDisposalDetail,
  type NativeDisposalPatch,
  type NativeDisposalsList,
  mapNativeDisposal,
  mapNativeDisposalDetail,
  nativeDisposalFilterStatuses,
  parseNativeDisposalId,
  parseNativeDisposalListFilter,
  toListingUpdateInput,
  workspaceShowsNativeDisposals,
} from './disposals-shared';
import { NativeHttpError } from './http';
import type { NativeWorkspace } from './workspace-shared';

export type {
  NativeDisposal,
  NativeDisposalDetail,
  NativeDisposalsList,
} from './disposals-shared';
export { NativeDisposalPatchSchema } from './disposals-shared';

const DISPOSAL_LIST_PAGE_SIZE = 100;

function requireDisposalsWorkspace(workspace: NativeWorkspace) {
  if (!workspaceShowsNativeDisposals(workspace.profile)) {
    throw new NativeHttpError(404, 'Disposals are not available here');
  }
}

export async function listNativeDisposals(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  userId: string,
  options?: { status?: string | null; search?: string | null },
): Promise<NativeDisposalsList> {
  requireDisposalsWorkspace(workspace);

  const statuses = nativeDisposalFilterStatuses(
    parseNativeDisposalListFilter(options?.status),
  );
  const [page, canEdit] = await Promise.all([
    createListingsService(client).listListingsPage({
      accountId: workspace.id,
      statuses: statuses.length > 0 ? statuses : undefined,
      search: options?.search?.trim().slice(0, 120) || null,
      page: 1,
      pageSize: DISPOSAL_LIST_PAGE_SIZE,
    }),
    canCommercialMutateDisposals({ client, accountId: workspace.id, userId }),
  ]);

  return {
    items: page.data.map(mapNativeDisposal),
    total: page.total,
    can_edit: canEdit,
  };
}

export async function getNativeDisposal(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  userId: string,
  disposalId: string,
): Promise<NativeDisposalDetail> {
  requireDisposalsWorkspace(workspace);
  const id = parseNativeDisposalId(disposalId);

  const [listing, canEdit] = await Promise.all([
    createListingsService(client).getListing(id, workspace.id),
    canCommercialMutateDisposals({ client, accountId: workspace.id, userId }),
  ]);
  if (!listing) {
    throw new NativeHttpError(404, 'Disposal not found');
  }

  return mapNativeDisposalDetail(listing, canEdit);
}

export async function updateNativeDisposal(
  client: SupabaseClient,
  workspace: NativeWorkspace,
  userId: string,
  disposalId: string,
  patch: NativeDisposalPatch,
): Promise<NativeDisposalDetail> {
  requireDisposalsWorkspace(workspace);
  const id = parseNativeDisposalId(disposalId);

  const service = createListingsService(client);
  const [canEdit, existing] = await Promise.all([
    canCommercialMutateDisposals({ client, accountId: workspace.id, userId }),
    service.getListing(id, workspace.id),
  ]);
  if (!canEdit) {
    throw new NativeHttpError(
      403,
      'Support seats can’t edit disposals. Ask a billable team member, or upgrade this seat.',
    );
  }

  if (!existing) {
    throw new NativeHttpError(404, 'Disposal not found');
  }

  const sizeMin =
    patch.size_min_sqft !== undefined
      ? patch.size_min_sqft
      : existing.sizeMinSqft;
  const sizeMax =
    patch.size_max_sqft !== undefined
      ? patch.size_max_sqft
      : existing.sizeMaxSqft;
  if (sizeMin != null && sizeMax != null && sizeMin > sizeMax) {
    throw new NativeHttpError(400, 'Minimum size must not exceed maximum size');
  }

  const updated = await service.updateListing(
    id,
    workspace.id,
    toListingUpdateInput(patch),
    { actorUserId: userId },
  );
  revalidateDisposalsCaches({ accountId: workspace.id, userId, listingId: id });

  return mapNativeDisposalDetail(
    {
      ...updated,
      coverUrl: existing.coverUrl,
      actingAgents: existing.actingAgents,
    },
    canEdit,
  );
}
