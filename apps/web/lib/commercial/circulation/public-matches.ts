import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  type AccountBrandResolved,
  loadAccountBrandResolved,
} from '~/lib/brand/account-brand';
import { createCommercialCirculationService } from '~/lib/commercial/circulation/circulation.service';
import { listContactMatches } from '~/lib/commercial/circulation/contact-matches';

export type PublicMatchesPage = {
  token: string;
  email: string;
  contactName: string | null;
  agencyName: string;
  brand: AccountBrandResolved;
  unsubscribed: boolean;
  notifyOnNewMatch: boolean;
  listings: Array<{
    listingId: string;
    name: string;
    summary: string;
    address: string;
    town: string | null;
    sector: string | null;
    disposalTypeLabel: string;
    sizeLabel: string | null;
    viewUrl: string | null;
    viewUrlLabel: string | null;
    websiteListingUrl: string | null;
    coverImageUrl: string | null;
  }>;
};

export async function loadPublicMatchesByToken(
  admin: SupabaseClient,
  token: string,
  siteUrl: string | null,
): Promise<PublicMatchesPage | null> {
  const circulation = createCommercialCirculationService(admin);
  const preference = await circulation.loadPreferenceByPublicToken(token);
  if (!preference) return null;

  const [{ data: account }, brand, contacts] = await Promise.all([
    admin
      .from('accounts')
      .select('name')
      .eq('id', preference.accountId)
      .maybeSingle(),
    loadAccountBrandResolved(preference.accountId),
    listContactMatches(admin, {
      accountId: preference.accountId,
      email: preference.email,
      siteUrl,
    }),
  ]);

  const contact = contacts[0] ?? null;
  const agencyName =
    (account as { name?: string | null } | null)?.name?.trim() || 'Agency';

  return {
    token: preference.publicAccessToken,
    email: preference.email,
    contactName: contact?.contactName ?? null,
    agencyName,
    brand,
    unsubscribed:
      preference.marketingStatus === 'unsubscribed' ||
      preference.marketingStatus === 'suppressed',
    notifyOnNewMatch:
      preference.marketingStatus === 'subscribed' && preference.autoSendEnabled,
    listings: (contact?.listings ?? []).map((listing) => ({
      listingId: listing.listingId,
      name: listing.name,
      summary: listing.summary,
      address: listing.address,
      town: listing.town,
      sector: listing.sector,
      disposalTypeLabel: listing.disposalTypeLabel,
      sizeLabel: listing.sizeLabel,
      viewUrl: listing.viewUrl,
      viewUrlLabel: listing.viewUrlLabel,
      websiteListingUrl: listing.websiteListingUrl,
      coverImageUrl: listing.coverImageUrl,
    })),
  };
}
