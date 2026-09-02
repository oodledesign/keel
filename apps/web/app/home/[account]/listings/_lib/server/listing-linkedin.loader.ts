import 'server-only';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import {
  findEditableLinkedInPost,
  loadLastPostedListingLinkedIn,
  loadLatestListingLinkedInPost,
  loadLinkedInOrgConnection,
} from '~/lib/commercial/linkedin-publishing/connections';
import type {
  LinkedInOrgConnectionPublic,
  ListingLinkedInPostPublic,
} from '~/lib/commercial/linkedin-publishing/types';

export async function loadListingLinkedInCardData(
  accountId: string,
  listingId: string,
): Promise<{
  connection: LinkedInOrgConnectionPublic | null;
  draft: ListingLinkedInPostPublic | null;
  lastPosted: ListingLinkedInPostPublic | null;
}> {
  const client = getSupabaseServerClient();
  const [connection, latest, lastPosted] = await Promise.all([
    loadLinkedInOrgConnection(client, accountId),
    loadLatestListingLinkedInPost(client, accountId, listingId),
    loadLastPostedListingLinkedIn(client, accountId, listingId),
  ]);

  return {
    connection,
    draft: findEditableLinkedInPost(latest) ?? latest,
    lastPosted,
  };
}
