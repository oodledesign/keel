import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  LinkedInApiError,
  refreshLinkedInToken,
} from '~/lib/commercial/linkedin-publishing/linkedin-api';
import { linkedInPermalinkFromUrn } from '~/lib/commercial/linkedin-publishing/listing-public-url';
import type {
  LinkedInConnectionStatus,
  LinkedInOrgConnectionPublic,
  LinkedInPostStatus,
  ListingLinkedInPostPublic,
} from '~/lib/commercial/linkedin-publishing/types';
import {
  decryptIgToken,
  encryptIgToken,
} from '~/lib/instagram-autoreply/token-crypto';

type ConnectionRow = {
  id: string;
  account_id: string;
  org_id: string;
  org_urn: string;
  org_name: string | null;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  connected_by: string | null;
  connected_at: string;
  status: LinkedInConnectionStatus;
};

type PostRow = {
  id: string;
  account_id: string;
  listing_id: string;
  body: string;
  image_media_ids: unknown;
  overlay_first: boolean;
  listing_url: string | null;
  status: LinkedInPostStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  linkedin_post_urn: string | null;
  error: string | null;
  updated_at: string;
};

export function mapConnectionPublic(
  row: ConnectionRow,
): LinkedInOrgConnectionPublic {
  return {
    orgId: row.org_id,
    orgUrn: row.org_urn,
    orgName: row.org_name,
    status: row.status,
    connectedAt: row.connected_at,
    tokenExpiresAt: row.token_expires_at,
  };
}

export function parseImageMediaIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is string => typeof id === 'string' && id.length > 0,
  );
}

export function mapPostPublic(row: PostRow): ListingLinkedInPostPublic {
  return {
    id: row.id,
    body: row.body ?? '',
    imageMediaIds: parseImageMediaIds(row.image_media_ids),
    overlayFirst: Boolean(row.overlay_first),
    listingUrl: row.listing_url,
    status: row.status,
    scheduledAt: row.scheduled_at,
    postedAt: row.posted_at,
    linkedinPostUrn: row.linkedin_post_urn,
    linkedinPostUrl: linkedInPermalinkFromUrn(row.linkedin_post_urn),
    error: row.error,
    updatedAt: row.updated_at,
  };
}

export async function loadLinkedInOrgConnection(
  client: SupabaseClient,
  accountId: string,
): Promise<LinkedInOrgConnectionPublic | null> {
  const { data, error } = await client
    .from('linkedin_org_connections')
    .select(
      'id, account_id, org_id, org_urn, org_name, access_token, refresh_token, token_expires_at, connected_by, connected_at, status',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  const row = data as ConnectionRow;
  if (row.status === 'disconnected') return null;
  return mapConnectionPublic(row);
}

export async function loadLatestListingLinkedInPost(
  client: SupabaseClient,
  accountId: string,
  listingId: string,
): Promise<ListingLinkedInPostPublic | null> {
  const { data, error } = await client
    .from('listing_linkedin_posts')
    .select(
      'id, account_id, listing_id, body, image_media_ids, overlay_first, listing_url, status, scheduled_at, posted_at, linkedin_post_urn, error, updated_at',
    )
    .eq('account_id', accountId)
    .eq('listing_id', listingId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPostPublic(data as PostRow);
}

export async function loadLastPostedListingLinkedIn(
  client: SupabaseClient,
  accountId: string,
  listingId: string,
): Promise<ListingLinkedInPostPublic | null> {
  const { data, error } = await client
    .from('listing_linkedin_posts')
    .select(
      'id, account_id, listing_id, body, image_media_ids, overlay_first, listing_url, status, scheduled_at, posted_at, linkedin_post_urn, error, updated_at',
    )
    .eq('account_id', accountId)
    .eq('listing_id', listingId)
    .eq('status', 'posted')
    .order('posted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return mapPostPublic(data as PostRow);
}

export async function upsertLinkedInOrgConnection(
  client: SupabaseClient,
  input: {
    accountId: string;
    orgId: string;
    orgUrn: string;
    orgName: string | null;
    accessToken: string;
    refreshToken: string | null;
    expiresAt: string | null;
    connectedBy: string;
  },
): Promise<void> {
  const { error } = await client.from('linkedin_org_connections').upsert(
    {
      account_id: input.accountId,
      org_id: input.orgId,
      org_urn: input.orgUrn,
      org_name: input.orgName,
      access_token: encryptIgToken(input.accessToken),
      refresh_token: input.refreshToken
        ? encryptIgToken(input.refreshToken)
        : null,
      token_expires_at: input.expiresAt,
      connected_by: input.connectedBy,
      connected_at: new Date().toISOString(),
      status: 'connected',
    },
    { onConflict: 'account_id' },
  );

  if (error) throw new Error(error.message);
}

export async function deleteLinkedInOrgConnection(
  client: SupabaseClient,
  accountId: string,
): Promise<void> {
  const { error } = await client
    .from('linkedin_org_connections')
    .delete()
    .eq('account_id', accountId);
  if (error) throw new Error(error.message);
}

export async function markLinkedInConnectionNeedsReconnect(
  client: SupabaseClient,
  accountId: string,
): Promise<void> {
  await client
    .from('linkedin_org_connections')
    .update({ status: 'needs_reconnect' })
    .eq('account_id', accountId);
}

export async function resolveLinkedInAccessToken(
  client: SupabaseClient,
  accountId: string,
): Promise<{
  accessToken: string;
  orgUrn: string;
  orgName: string | null;
}> {
  const { data, error } = await client
    .from('linkedin_org_connections')
    .select(
      'account_id, org_urn, org_name, access_token, refresh_token, token_expires_at, status',
    )
    .eq('account_id', accountId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  const row = data as ConnectionRow | null;
  if (!row || row.status === 'disconnected') {
    throw new Error('No LinkedIn company page is connected');
  }
  if (row.status === 'needs_reconnect') {
    throw new LinkedInApiError(
      'Reconnect the LinkedIn company page in Website & portals',
      401,
    );
  }

  let accessToken = decryptIgToken(row.access_token);
  const refreshToken = row.refresh_token
    ? decryptIgToken(row.refresh_token)
    : null;
  const expiresAt = row.token_expires_at
    ? new Date(row.token_expires_at).getTime()
    : null;
  const stale = expiresAt != null && expiresAt < Date.now() + 5 * 60 * 1000;

  if (stale && refreshToken) {
    try {
      const refreshed = await refreshLinkedInToken(refreshToken);
      accessToken = refreshed.accessToken;
      const nextExpiry = new Date(
        Date.now() + Math.max(refreshed.expiresIn, 3600) * 1000,
      ).toISOString();
      await client
        .from('linkedin_org_connections')
        .update({
          access_token: encryptIgToken(refreshed.accessToken),
          refresh_token: refreshed.refreshToken
            ? encryptIgToken(refreshed.refreshToken)
            : row.refresh_token,
          token_expires_at: nextExpiry,
          status: 'connected',
        })
        .eq('account_id', accountId);
    } catch {
      await markLinkedInConnectionNeedsReconnect(client, accountId);
      throw new LinkedInApiError(
        'LinkedIn session expired. Reconnect the company page.',
        401,
      );
    }
  }

  return {
    accessToken,
    orgUrn: row.org_urn,
    orgName: row.org_name,
  };
}

export function findEditableLinkedInPost(
  latest: ListingLinkedInPostPublic | null,
): ListingLinkedInPostPublic | null {
  if (!latest) return null;
  if (latest.status === 'posted' || latest.status === 'posting') return null;
  return latest;
}
