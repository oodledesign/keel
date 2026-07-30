'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Edit2, Link2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import {
  DISPOSAL_TYPE_LABELS,
  ENQUIRY_STATUS_LABELS,
  type EnquiryStatus,
  LISTING_STATUS_LABELS,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type {
  CommercialEnquiry,
  CommercialListing,
  CommercialListingMedia,
  CommercialListingUnit,
  CommercialPortalPublication,
} from '../_lib/server/listings.service';
import {
  deleteListingUnit,
  setLandlordShare,
} from '../_lib/server/server-actions';
import { ListingFormModal } from './listing-form-modal';
import { ListingMediaSection } from './listing-media-section';
import { ListingUnitFormModal } from './listing-unit-form-modal';

interface ListingDetailContentProps {
  listing: CommercialListing;
  units: CommercialListingUnit[];
  media: CommercialListingMedia[];
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
  units: initialUnits,
  media,
  enquiries,
  publications,
  accountId,
  accountSlug: _accountSlug,
}: ListingDetailContentProps) {
  const router = useRouter();
  const [listing, setListing] = useState(initial);
  const [units, setUnits] = useState(initialUnits);
  const [modalOpen, setModalOpen] = useState(false);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<CommercialListingUnit | null>(
    null,
  );
  const [sharePending, startShareTransition] = useTransition();
  const [, startUnitTransition] = useTransition();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setListing(initial);
  }, [initial]);

  useEffect(() => {
    setUnits(initialUnits);
  }, [initialUnits]);

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

  const openAddUnit = () => {
    setEditingUnit(null);
    setUnitModalOpen(true);
  };

  const openEditUnit = (unit: CommercialListingUnit) => {
    setEditingUnit(unit);
    setUnitModalOpen(true);
  };

  const handleDeleteUnit = (unitId: string) => {
    if (!confirm('Delete this unit?')) return;
    startUnitTransition(async () => {
      try {
        await deleteListingUnit({ unitId, accountId });
        setUnits((prev) => prev.filter((u) => u.id !== unitId));
      } catch (err) {
        console.error(err);
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-[var(--workspace-shell-text)]">
            {listing.name}
          </h2>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
            {[listing.addressLine1, listing.addressLine2, listing.town, listing.postcode]
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
            {listing.sector ? (
              <span className="inline-flex rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-text)]/60">
                {listing.sector}
              </span>
            ) : null}
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

      <ListingMediaSection
        accountId={accountId}
        listingId={listing.id}
        initialMedia={media}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <DetailItem label="Tenure" value={listing.tenure} />
              <DetailItem label="Use class" value={listing.useClass} />
              <DetailItem label="EPC" value={listing.epcBand} />
              <DetailItem
                label="Available from"
                value={
                  listing.availableFrom
                    ? new Date(listing.availableFrom).toLocaleDateString('en-GB')
                    : null
                }
              />
              <DetailItem
                label="Measurement"
                value={listing.measurementStandard?.toUpperCase() ?? null}
              />
              <DetailItem
                label="Rent frequency"
                value={listing.rentFrequency?.replace(/_/g, ' ') ?? null}
              />
            </dl>
          </CardContent>
        </Card>

        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Marketing copy
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {listing.summary || listing.description || listing.locationCopy ? (
              <>
                {listing.summary ? (
                  <CopyBlock title="Summary" body={listing.summary} />
                ) : null}
                {listing.description ? (
                  <CopyBlock title="Description" body={listing.description} />
                ) : null}
                {listing.locationCopy ? (
                  <CopyBlock title="Location" body={listing.locationCopy} />
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--workspace-shell-text)]/50">
                No marketing copy yet. Use Edit to add summary, description and
                location.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <Card className={workspacePanelCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Units
          </CardTitle>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={openAddUnit}
          >
            <Plus className="h-3.5 w-3.5" />
            Add unit
          </Button>
        </CardHeader>
        <CardContent>
          {units.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No units recorded yet. Add floor units for multi-let disposals.
            </p>
          ) : (
            <ul className="divide-y divide-[color:var(--workspace-shell-border)]">
              {units.map((unit) => (
                <li
                  key={unit.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-[var(--workspace-shell-text)]">
                      {unit.label}
                    </p>
                    <p className="text-xs text-[var(--workspace-shell-text)]/45">
                      {[
                        unit.floorOrUnit,
                        unit.sizeSqft != null
                          ? `${unit.sizeSqft} sq ft`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEditUnit(unit)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400"
                      onClick={() => handleDeleteUnit(unit.id)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
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
                <thead className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  <tr>
                    <th className="pr-3 pb-2 font-medium">Contact</th>
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
                      <td className="py-2.5 pr-3 text-[var(--workspace-shell-text)]/70 capitalize">
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
                    <span className="text-[var(--workspace-shell-text)] capitalize">
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
        onSaved={(saved) => {
          setListing(saved);
          router.refresh();
        }}
      />

      <ListingUnitFormModal
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        accountId={accountId}
        listingId={listing.id}
        unit={editingUnit}
        onSaved={(saved) => {
          setUnits((prev) => {
            const idx = prev.findIndex((u) => u.id === saved.id);
            if (idx >= 0) {
              const next = [...prev];
              next[idx] = saved;
              return next;
            }
            return [...prev, saved];
          });
        }}
      />
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className={workspacePanelCard}>
      <CardContent className="p-4">
        <p className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
          {label}
        </p>
        <p className="mt-1 text-lg font-semibold text-[var(--workspace-shell-text)]">
          {value}
        </p>
      </CardContent>
    </Card>
  );
}

function DetailItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <dt className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
        {label}
      </dt>
      <dd className="mt-0.5 text-[var(--workspace-shell-text)]">
        {value?.trim() ? value : '—'}
      </dd>
    </div>
  );
}

function CopyBlock({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <p className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
        {title}
      </p>
      <p className="mt-1 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]/70">
        {body}
      </p>
    </div>
  );
}
