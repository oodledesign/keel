import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { loadAccountBranches } from '~/lib/brand/account-branches';
import {
  buildEachFeedUrl,
  buildPropertyHiveFeedUrl,
} from '~/lib/commercial/property-hive-feed';
import {
  getRightmoveEnvironmentLabel,
  isRightmoveOAuthConfigured,
} from '~/lib/commercial/rightmove-env';

export type RightmoveWorkspaceBranch = {
  id: string;
  name: string;
  rightmoveBranchId: string | null;
};

export type CommercialPublishingSettings = {
  propertyHive: {
    configured: boolean;
    siteUrl: string;
    username: string;
    officeId: string | null;
    feedUrl: string | null;
    feedEnabled: boolean;
  };
  rightmove: {
    /** Platform OAuth client credentials present in env. */
    oauthConfigured: boolean;
    environment: 'test' | 'production';
    /** At least one workspace branch has a Rightmove Branch ID. */
    branchConfigured: boolean;
    /** Legacy combined flag — true when OAuth env is ready. */
    configured: boolean;
    workspaceBranches: RightmoveWorkspaceBranch[];
  };
  each: {
    /** Dedicated EACH XML feed enabled (separate token from Property Hive). */
    configured: boolean;
    feedUrl: string | null;
    feedEnabled: boolean;
  };
  recentPublicationIssues: Array<{
    id: string;
    listingId: string;
    listingName: string | null;
    portal: string;
    status: string;
    lastSyncAt: string | null;
    lastError: string | null;
  }>;
};

function isConfigured(
  row: {
    secret_ciphertext?: string | null;
    username?: string | null;
  } | null,
): boolean {
  return Boolean(row?.secret_ciphertext && row?.username);
}

export async function loadCommercialPublishingSettings(
  accountId: string,
): Promise<CommercialPublishingSettings> {
  const client = getSupabaseServerClient() as unknown as SupabaseClient;

  const [{ data, error }, branches] = await Promise.all([
    client
      .from('commercial_portal_credentials')
      .select(
        'portal, site_url, username, office_id, branch_id, network_id, secret_ciphertext, metadata',
      )
      .eq('account_id', accountId),
    loadAccountBranches(accountId),
  ]);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byPortal = Object.fromEntries(
    rows.map((row) => [row.portal as string, row]),
  );

  const ph = byPortal.property_hive ?? null;
  const eachRow = byPortal.each ?? null;
  const phMetadata = (ph?.metadata ?? {}) as Record<string, unknown>;
  const eachMetadata = (eachRow?.metadata ?? {}) as Record<string, unknown>;
  const feedToken =
    typeof phMetadata.xml_feed_token === 'string'
      ? phMetadata.xml_feed_token
      : null;
  const eachFeedToken =
    typeof eachMetadata.xml_feed_token === 'string'
      ? eachMetadata.xml_feed_token
      : null;
  const feedUrl = feedToken ? buildPropertyHiveFeedUrl(feedToken) : null;
  const eachFeedUrl = eachFeedToken ? buildEachFeedUrl(eachFeedToken) : null;
  const feedEnabled = Boolean(feedToken);
  const eachFeedEnabled = Boolean(eachFeedToken);

  const oauthConfigured = isRightmoveOAuthConfigured();
  const workspaceBranches: RightmoveWorkspaceBranch[] = branches.map(
    (branch) => ({
      id: branch.id,
      name: branch.name,
      rightmoveBranchId: branch.rightmoveBranchId,
    }),
  );
  const branchConfigured = workspaceBranches.some((b) =>
    Boolean(b.rightmoveBranchId?.trim()),
  );

  const { data: issueRows } = await client
    .from('commercial_portal_publications')
    .select(
      'id, listing_id, portal, status, last_sync_at, last_error, commercial_listings(name)',
    )
    .eq('account_id', accountId)
    .or('status.eq.error,last_error.not.is.null')
    .order('last_sync_at', { ascending: false, nullsFirst: false })
    .limit(15);

  const recentPublicationIssues = (
    (issueRows ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const listingJoin = row.commercial_listings as
      | { name?: string }
      | { name?: string }[]
      | null;
    const listingName = Array.isArray(listingJoin)
      ? (listingJoin[0]?.name ?? null)
      : (listingJoin?.name ?? null);
    return {
      id: String(row.id),
      listingId: String(row.listing_id),
      listingName,
      portal: String(row.portal ?? ''),
      status: String(row.status ?? ''),
      lastSyncAt: (row.last_sync_at as string | null) ?? null,
      lastError: (row.last_error as string | null) ?? null,
    };
  });

  return {
    propertyHive: {
      configured: isConfigured(ph),
      siteUrl: (ph?.site_url as string | undefined) ?? '',
      username: (ph?.username as string | undefined) ?? '',
      officeId: (ph?.office_id as string | null | undefined) ?? null,
      feedUrl,
      feedEnabled,
    },
    rightmove: {
      oauthConfigured,
      environment: getRightmoveEnvironmentLabel(),
      branchConfigured,
      configured: oauthConfigured,
      workspaceBranches,
    },
    each: {
      configured: eachFeedEnabled,
      feedUrl: eachFeedUrl,
      feedEnabled: eachFeedEnabled,
    },
    recentPublicationIssues,
  };
}
