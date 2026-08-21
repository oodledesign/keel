import type { SupabaseClient } from '@supabase/supabase-js';

import { getSupabaseServerAdminClient } from '@kit/supabase/server-admin-client';

import { ListingStatusBadge } from '~/components/commercial/listing-status-badge';
import {
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
  type ListingStatus,
  disposalIncludesForSale,
  disposalIncludesToLet,
} from '~/lib/commercial/commercial-constants';
import { withI18n } from '~/lib/i18n/with-i18n';
import { workspacePanelCard } from '~/lib/workspace-ui';

interface LandlordSharePageProps {
  params: Promise<{ token: string }>;
}

type SharedListing = {
  id: string;
  name: string;
  address_line_1: string | null;
  address_line_2: string | null;
  town: string | null;
  postcode: string | null;
  status: string;
  disposal_type: string;
  asking_rent_pence: number | null;
  asking_rent_to_pence: number | null;
  asking_price_pence: number | null;
  size_min_sqft: number | null;
  size_max_sqft: number | null;
  hide_rent_from_marketing: boolean;
  hide_price_from_marketing: boolean;
};

type SharedEnquiry = {
  id: string;
  contact_name: string | null;
  source: string;
  status: string;
  created_at: string;
  company_name: string | null;
};

function formatMoney(pence: number | null) {
  if (pence == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatAddress(listing: SharedListing) {
  return [
    listing.address_line_1,
    listing.address_line_2,
    listing.town,
    listing.postcode,
  ]
    .filter(Boolean)
    .join(', ');
}

async function loadSharedListing(
  token: string,
): Promise<{ listing: SharedListing; enquiries: SharedEnquiry[] } | null> {
  if (!token || token.length < 16) {
    return null;
  }

  // Token-gated public page — use admin client (matches /watch share pattern).
  // Anon has no table GRANT; relying on session client would 404 for landlords.
  const admin = getSupabaseServerAdminClient() as unknown as SupabaseClient;

  const { data: listing, error } = await admin
    .from('commercial_listings')
    .select(
      'id, name, address_line_1, address_line_2, town, postcode, status, disposal_type, asking_rent_pence, asking_rent_to_pence, asking_price_pence, size_min_sqft, size_max_sqft, hide_rent_from_marketing, hide_price_from_marketing',
    )
    .eq('landlord_share_token', token)
    .eq('landlord_share_enabled', true)
    .maybeSingle();

  if (error || !listing) {
    return null;
  }

  const { data: enquiryRows, error: enquiryError } = await admin
    .from('commercial_enquiries')
    .select(
      'id, contact_name, source, status, created_at, requirement_id, commercial_requirements(company_name)',
    )
    .eq('listing_id', listing.id)
    .order('created_at', { ascending: false });

  if (enquiryError) {
    throw new Error(enquiryError.message);
  }

  const enquiries: SharedEnquiry[] = (
    (enquiryRows ?? []) as Array<Record<string, unknown>>
  ).map((row) => {
    const requirement = row.commercial_requirements as
      | { company_name: string | null }
      | { company_name: string | null }[]
      | null;

    const company =
      requirement && !Array.isArray(requirement)
        ? requirement.company_name
        : Array.isArray(requirement)
          ? (requirement[0]?.company_name ?? null)
          : null;

    return {
      id: row.id as string,
      contact_name: (row.contact_name as string | null) ?? null,
      source: (row.source as string) ?? 'manual',
      status: (row.status as string) ?? 'unactioned',
      created_at: row.created_at as string,
      company_name: company,
    };
  });

  return { listing: listing as SharedListing, enquiries };
}

export const generateMetadata = async ({ params }: LandlordSharePageProps) => {
  const { token } = await params;
  const data = await loadSharedListing(token);
  return {
    title: data?.listing.name ?? 'Listing not found',
    robots: { index: false, follow: false },
  };
};

async function LandlordSharePage({ params }: LandlordSharePageProps) {
  const { token } = await params;
  const data = await loadSharedListing(token);

  if (!data) {
    return (
      <main className="min-h-screen bg-[var(--workspace-shell-canvas)] px-4 py-16">
        <div className="mx-auto max-w-lg text-center">
          <h1 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Listing not found
          </h1>
          <p className="mt-2 text-sm text-[var(--workspace-shell-text)]/60">
            This share link is invalid or has been disabled.
          </p>
        </div>
      </main>
    );
  }

  const { listing, enquiries } = data;
  const disposalType = listing.disposal_type as DisposalType;
  const listingStatus = listing.status as ListingStatus;

  const sizeLabel =
    listing.size_min_sqft != null || listing.size_max_sqft != null
      ? `${[listing.size_min_sqft, listing.size_max_sqft]
          .filter((v) => v != null)
          .join('–')} sq ft`
      : '—';

  const rentLabel = (() => {
    if (!disposalIncludesToLet(disposalType)) return '—';
    if (listing.hide_rent_from_marketing) return 'On application';
    const from = listing.asking_rent_pence;
    const to = listing.asking_rent_to_pence;
    if (from == null && to == null) return '—';
    if (from != null && to != null && from !== to) {
      return `${formatMoney(from)} – ${formatMoney(to)}`;
    }
    return formatMoney(from ?? to);
  })();

  const priceLabel = (() => {
    if (!disposalIncludesForSale(disposalType)) return '—';
    if (listing.hide_price_from_marketing) return 'On application';
    return formatMoney(listing.asking_price_pence);
  })();

  return (
    <main className="min-h-screen bg-[var(--workspace-shell-canvas)] px-4 py-10">
      <div className="mx-auto max-w-3xl space-y-6">
        <header className="space-y-2">
          <p className="text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
            Landlord share
          </p>
          <h1 className="text-2xl font-semibold text-[var(--workspace-shell-text)]">
            {listing.name}
          </h1>
          <p className="text-sm text-[var(--workspace-shell-text)]/60">
            {formatAddress(listing) || 'No address recorded'}
          </p>
          <div className="flex flex-wrap gap-2 pt-1">
            <ListingStatusBadge status={listingStatus} />
            <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
              {DISPOSAL_TYPE_LABELS[disposalType] ?? listing.disposal_type}
            </span>
          </div>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryTile label="Asking rent" value={rentLabel} />
          <SummaryTile label="Asking price" value={priceLabel} />
          <SummaryTile label="Size" value={sizeLabel} />
        </div>

        <section className={`${workspacePanelCard} p-5`}>
          <h2 className="text-base font-semibold text-[var(--workspace-shell-text)]">
            Interest schedule
          </h2>
          {enquiries.length === 0 ? (
            <p className="mt-3 text-sm text-[var(--workspace-shell-text)]/50">
              No enquiries recorded yet.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  <tr>
                    <th className="pr-3 pb-2 font-medium">Contact</th>
                    <th className="pr-3 pb-2 font-medium">Company</th>
                    <th className="pr-3 pb-2 font-medium">Source</th>
                    <th className="pr-3 pb-2 font-medium">Status</th>
                    <th className="pb-2 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => (
                    <tr
                      key={enquiry.id}
                      className="border-t border-[color:var(--workspace-shell-border)]"
                    >
                      <td className="py-2.5 pr-3 font-medium text-[var(--workspace-shell-text)]">
                        {enquiry.contact_name || 'Unknown'}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--workspace-shell-text)]/70">
                        {enquiry.company_name || '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--workspace-shell-text)]/70 capitalize">
                        {enquiry.source}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--workspace-shell-text)]/70">
                        {ENQUIRY_STATUS_LABELS[
                          enquiry.status as EnquiryStatus
                        ] ?? enquiry.status}
                      </td>
                      <td className="py-2.5 text-[var(--workspace-shell-text)]/70">
                        {new Date(enquiry.created_at).toLocaleDateString(
                          'en-GB',
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-center text-xs text-[var(--workspace-shell-text)]/40">
          Read-only view for landlords. Data updates when your agent records new
          interest.
        </p>
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: string }) {
  return (
    <div className={`${workspacePanelCard} p-4`}>
      <p className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold text-[var(--workspace-shell-text)]">
        {value}
      </p>
    </div>
  );
}

export default withI18n(LandlordSharePage);
