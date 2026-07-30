'use client';

import { useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Edit2, Link2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_LABELS,
  ENQUIRY_STATUS_LABELS,
  LISTING_STATUS_LABELS,
  type EnquiryStatus,
} from '~/lib/commercial/commercial-constants';
import {
  workspaceBtnPrimaryMd,
  workspacePanelCard,
} from '~/lib/workspace-ui';

import type {
  CommercialEnquiry,
  CommercialListing,
  CommercialListingUnit,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import { setLandlordShare } from '../_lib/server/server-actions';
import { ListingFormModal } from './listing-form-modal';

interface ListingDetailContentProps {
  listing: CommercialListing;
  units: CommercialListingUnit[];
  enquiries: CommercialEnquiry[];
  publications: CommercialPortalPublication[];
  accountId: string;
  accountSlug: string;
}

function formatMoney(pence: number | null) {
  if (pence == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function daysOnMarket(onMarketAt: string | null) {
  if (!onMarketAt) return null;
  const start = new Date(onMarketAt).getTime();
  if (Number.isNaN(start)) return null;
  return Math.max(0, Math.floor((Date.now() - start) / (1000 * 60 * 60 * 24)));
}

export function ListingDetailContent({
  listing: initial,
  units,
  enquiries,
  publications,
  accountId,
  accountSlug: _accountSlug,
}: ListingDetailContentProps) {
  const router = useRouter();
  const [listing, setListing] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const [sharePending, startShareTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  const sharePath = listing.landlordShareToken
    ? pathsConfig.app.landlordShareListing.replace(
        '[token]',
        listing.landlordShareToken,
      )
    : null;
  const shareUrl =
    typeof window !== 'undefined' && sharePath
      ? `${window.location.origin}${sharePath}`
      : sharePath;

  const dom = daysOnMarket(listing.onMarketAt);

  const toggleShare = (enabled: boolean) => {
    startShareTransition(async () => {
      try {
        const updated = await setLandlordShare({
          listingId: listing.id,
          accountId,
          enabled,
        });
        setListing(updated);
        router.refresh();
      } catch (err) {
        console.error(err);
      }
    });
  };

  const copyShareLink = async () => {
    if (!shareUrl) return;
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
            {listing.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
            {[listing.addressLine1, listing.town, listing.postcode]
              .filter(Boolean)
              .join(', ') || 'No address'}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="inline-flex rounded-full bg-[var(--ozer-accent-subtle)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)]">
              {LISTING_STATUS_LABELS[listing.status]}
            </span>
            <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
              {DISPOSAL_TYPE_LABELS[listing.disposalType]}
            </span>
          </div>
        </div>
        <Button
          onClick={() => setModalOpen(true)}
          className={workspaceBtnPrimaryMd}
        >
          <Edit2 className="h-4 w-4" />
          Edit
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Asking rent"
          value={formatMoney(listing.askingRentPence)}
        />
        <SummaryCard
          label="Asking price"
          value={formatMoney(listing.askingPricePence)}
        />
        <SummaryCard
          label="Size"
          value={
            listing.sizeMinSqft != null || listing.sizeMaxSqft != null
              ? `${[listing.sizeMinSqft, listing.sizeMaxSqft].filter((v) => v != null).join('–')} sq ft`
              : '—'
          }
        />
        <SummaryCard
          label="Days on market"
          value={dom != null ? String(dom) : '—'}
        />
      </div>

      {listing.summary ? (
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Summary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap text-sm text-[var(--workspace-shell-text)]/70">
              {listing.summary}
            </p>
          </CardContent>
        </Card>
      ) : null}

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Units
          </CardTitle>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No units recorded yet.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex items-center justify-between py-2 text-sm"
                >
                  <span className="text-[var(--workspace-shell-text)]">
                    {unit.label}
                    {unit.floorOrUnit ? (
                      <span className="text-[var(--workspace-shell-text)]/45">
                        {' '}
                        · {unit.floorOrUnit}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[var(--workspace-shell-text)]/60">
                    {unit.sizeSqft != null ? `${unit.sizeSqft} sq ft` : '—'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Interest schedule
          </CardTitle>
        </CardHeader>
        <CardContent>
          {enquiries.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No enquiries yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
                  <tr>
                    <th className="pb-2 pr-3 font-medium">Contact</th>
                    <th className="pb-2 pr-3 font-medium">Source</th>
                    <th className="pb-2 pr-3 font-medium">Status</th>
                    <th className="pb-2 font-medium">Received</th>
                  </tr>
                </thead>
                <tbody>
                  {enquiries.map((enquiry) => (
                    <tr
                      key={enquiry.id}
                      className="border-t border-[color:var(--workspace-shell-border)]"
                    >
                      <td className="py-2.5 pr-3">
                        <div className="font-medium text-[var(--workspace-shell-text)]">
                          {enquiry.contactName || 'Unknown'}
                        </div>
                        {enquiry.contactEmail ? (
                          <div className="text-xs text-[var(--workspace-shell-text)]/45">
                            {enquiry.contactEmail}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2.5 pr-3 capitalize text-[var(--workspace-shell-text)]/70">
                        {enquiry.source}
                      </td>
                      <td className="py-2.5 pr-3 text-[var(--workspace-shell-text)]/70">
                        {ENQUIRY_STATUS_LABELS[
                          enquiry.status as EnquiryStatus
                        ] ?? enquiry.status}
                      </td>
                      <td className="py-2.5 text-[var(--workspace-shell-text)]/70">
                        {new Date(enquiry.receivedAt).toLocaleDateString(
                          'en-GB',
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Portal publishing
            </CardTitle>
          </CardHeader>
          <CardContent>
            {publications.length === 0 ? (
              <p className="text-sm text-[var(--workspace-shell-text)]/50">
                Not published to any portals yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {publications.map((pub) => (
                  <li
                    key={pub.id}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="capitalize text-[var(--workspace-shell-text)]">
                      {pub.portal.replace(/_/g, ' ')}
                    </span>
                    <span className="text-[var(--workspace-shell-text)]/60">
                      {pub.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
              <Link2 className="h-4 w-4" />
              Landlord share
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-[var(--workspace-shell-text)]/60">
                Share a read-only interest schedule with the landlord.
              </p>
              <Switch
                checked={listing.landlordShareEnabled}
                disabled={sharePending}
                onCheckedChange={toggleShare}
              />
            </div>
            {listing.landlordShareEnabled && sharePath ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs text-[var(--workspace-shell-text)]/70">
                  {shareUrl ?? sharePath}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyShareLink}
                  className="shrink-0 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {copied ? 'Copied' : 'Copy'}
                </Button>
              </div>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        listing={listing}
        onSaved={() => router.refresh()}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className={workspacePanelCard}>
      <CardContent className="p-4">
        <p className="text-[11px] uppercase tracking-wide text-[var(--workspace-shell-text)]/45">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--workspace-shell-text)]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}
