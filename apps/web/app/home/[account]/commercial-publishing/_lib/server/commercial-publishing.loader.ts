import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerClient } from '@kit/supabase/server-client';

import { buildPropertyHiveFeedUrl } from '~/lib/commercial/property-hive-feed';

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
    configured: boolean;
    branchId: string;
    networkId: string;
    username: string;
  };
  each: {
    configured: boolean;
    branchId: string;
    networkId: string;
    username: string;
  };
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

  const { data, error } = await client
    .from('commercial_portal_credentials')
    .select(
      'portal, site_url, username, office_id, branch_id, network_id, secret_ciphertext, metadata',
    )
    .eq('account_id', accountId);

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;
  const byPortal = Object.fromEntries(
    rows.map((row) => [row.portal as string, row]),
  );

  const ph = byPortal.property_hive ?? null;
  const rm = byPortal.rightmove ?? null;
  const each = byPortal.each ?? null;
  const phMetadata = (ph?.metadata ?? {}) as Record<string, unknown>;
  const feedToken =
    typeof phMetadata.xml_feed_token === 'string'
      ? phMetadata.xml_feed_token
      : null;

  return {
    propertyHive: {
      configured: isConfigured(ph),
      siteUrl: (ph?.site_url as string | undefined) ?? '',
      username: (ph?.username as string | undefined) ?? '',
      officeId: (ph?.office_id as string | null | undefined) ?? null,
      feedUrl: feedToken ? buildPropertyHiveFeedUrl(feedToken) : null,
      feedEnabled: Boolean(feedToken),
    },
    rightmove: {
      configured: isConfigured(rm),
      branchId: (rm?.branch_id as string | undefined) ?? '',
      networkId: (rm?.network_id as string | undefined) ?? '',
      username: (rm?.username as string | undefined) ?? '',
    },
    each: {
      configured: isConfigured(each),
      branchId: (each?.branch_id as string | undefined) ?? '',
      networkId: (each?.network_id as string | undefined) ?? '',
      username: (each?.username as string | undefined) ?? '',
    },
  };
}
