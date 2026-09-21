'use server';

import { enhanceAction } from '@kit/next/actions';
import { getLogger } from '@kit/shared/logger';
import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { EpcApiError } from '~/lib/building-surveyor/epc/types';

import {
  AttachListingEpcSchema,
  RefreshListingEpcSchema,
  SearchListingEpcSchema,
} from '../schema/listing-epc.schema';
import { createListingEpcService } from './listing-epc.service';

function getService() {
  return createListingEpcService(getSupabaseServerClient());
}

async function requireBillableDisposalActor(accountId: string) {
  const { requireCommercialBillableActor } =
    await import('~/lib/commercial/require-commercial-billable-actor');
  await requireCommercialBillableActor(accountId, 'create or edit disposals');
}

async function invalidateDisposalsData(input: {
  accountId: string;
  listingId?: string;
}) {
  const client = getSupabaseServerClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  const { revalidateDisposalsCaches } =
    await import('~/lib/cache/disposals-data-cache');
  revalidateDisposalsCaches({
    accountId: input.accountId,
    userId: user?.id,
    listingId: input.listingId,
  });
}

function rethrowEpc(error: unknown): never {
  if (error instanceof EpcApiError) {
    throw new Error(error.message);
  }
  throw error;
}

export const searchListingEpcAction = enhanceAction(
  async (data, user) => {
    await requireBillableDisposalActor(data.accountId);
    const logger = await getLogger();
    logger.info(
      {
        name: 'search-listing-epc',
        userId: user.id,
        listingId: data.listingId,
      },
      'Searching GOV.UK EPC register for disposal',
    );
    try {
      return await getService().search(data);
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: SearchListingEpcSchema },
);

export const attachListingEpcAction = enhanceAction(
  async (data, user) => {
    await requireBillableDisposalActor(data.accountId);
    const logger = await getLogger();
    logger.info(
      {
        name: 'attach-listing-epc',
        userId: user.id,
        listingId: data.listingId,
        certificateNumber: data.certificateNumber,
      },
      'Attaching GOV.UK EPC to disposal',
    );
    try {
      const result = await getService().attach(data);
      await invalidateDisposalsData({
        accountId: data.accountId,
        listingId: data.listingId,
      });
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: AttachListingEpcSchema },
);

export const refreshListingEpcAction = enhanceAction(
  async (data, user) => {
    await requireBillableDisposalActor(data.accountId);
    const logger = await getLogger();
    logger.info(
      {
        name: 'refresh-listing-epc',
        userId: user.id,
        listingId: data.listingId,
      },
      'Refreshing GOV.UK EPC for disposal',
    );
    try {
      const result = await getService().refresh(data);
      await invalidateDisposalsData({
        accountId: data.accountId,
        listingId: data.listingId,
      });
      return result;
    } catch (error) {
      rethrowEpc(error);
    }
  },
  { schema: RefreshListingEpcSchema },
);
