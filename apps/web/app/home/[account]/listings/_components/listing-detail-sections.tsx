'use client';

import { useEffect, useState, useTransition } from 'react';

import { useRouter } from 'next/navigation';

import { Copy, Edit2, Link2, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { Switch } from '@kit/ui/switch';

import pathsConfig from '~/config/paths.config';
import {
  ENQUIRY_SOURCES,
  ENQUIRY_SOURCE_LABELS,
  type EnquirySource,
  type EnquiryStatus,
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
  createListingEnquiry,
  deleteListingUnit,
  setLandlordShare,
  updateListingEnquiry,
} from '../_lib/server/server-actions';
import { ListingFormModal } from './listing-form-modal';
import { ListingMapCard } from './listing-map-card';
import { ListingMediaSection } from './listing-media-section';
import { ListingUnitFormModal } from './listing-unit-form-modal';

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

function useListingState(initial: CommercialListing) {
  const [listing, setListing] = useState(initial);
  const [modalOpen, setModalOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setListing(initial);
  }, [initial]);

  return {
    listing,
    setListing,
    modalOpen,
    setModalOpen,
    onSaved: (saved: CommercialListing) => {
      setListing(saved);
      router.refresh();
    },
  };
}

export function ListingOverviewSection({
  listing: initial,
  accountId,
  interestSummary,
}: {
  listing: CommercialListing;
  accountId: string;
  interestSummary?: {
    active: number;
    archived: number;
    total: number;
    linkedDeals: number;
    upcomingViewings?: number;
    awaitingFeedback?: number;
  };
}) {
  const { listing, modalOpen, setModalOpen, onSaved } =
    useListingState(initial);
  const dom = daysOnMarket(listing.onMarketAt);
  const summary = interestSummary ?? {
    active: 0,
    archived: 0,
    total: 0,
    linkedDeals: 0,
    upcomingViewings: 0,
    awaitingFeedback: 0,
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
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

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Interest funnel
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {(
              [
                { label: 'Enquiries', value: summary.total },
                { label: 'Active', value: summary.active },
                { label: 'Linked deals', value: summary.linkedDeals },
                { label: 'Archived', value: summary.archived },
                {
                  label: 'Upcoming viewings',
                  value: summary.upcomingViewings ?? 0,
                },
                {
                  label: 'Awaiting feedback',
                  value: summary.awaitingFeedback ?? 0,
                },
              ] as const
            ).map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3 text-center"
              >
                <p className="text-xl font-semibold text-[var(--workspace-shell-text)] tabular-nums">
                  {item.value}
                </p>
                <p className="mt-0.5 text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  {item.label}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

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
              <DetailItem
                label="EPC"
                value={
                  listing.epcBand
                    ? listing.epcRating != null
                      ? `${listing.epcBand} (${listing.epcRating})`
                      : listing.epcBand
                    : null
                }
              />
              <DetailItem
                label="Available from"
                value={
                  listing.availableFrom
                    ? new Date(listing.availableFrom).toLocaleDateString(
                        'en-GB',
                      )
                    : null
                }
              />
              <DetailItem
                label="Measurement"
                value={listing.measurementStandard?.toUpperCase() ?? null}
              />
              <DetailItem
                label="Instruction"
                value={listing.instructionNature}
              />
              <DetailItem label="Country" value={listing.country} />
              <DetailItem label="County" value={listing.county} />
              <DetailItem label="External ID" value={listing.externalId} />
              <DetailItem
                label="Hide rent"
                value={listing.hideRentFromMarketing ? 'Yes' : 'No'}
              />
            </dl>
          </CardContent>
        </Card>

        <ListingMapCard listing={listing} />
      </div>

      {listing.keyPoints.length > 0 ? (
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Key selling points
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-[var(--workspace-shell-text)]/70">
              {listing.keyPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        listing={listing}
        onSaved={onSaved}
      />
    </div>
  );
}

export function ListingMarketingSection({
  listing: initial,
  accountId,
}: {
  listing: CommercialListing;
  accountId: string;
}) {
  const { listing, modalOpen, setModalOpen, onSaved } =
    useListingState(initial);

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setModalOpen(true)}
          className={workspaceBtnPrimaryMd}
        >
          <Edit2 className="h-4 w-4" />
          Edit marketing
        </Button>
      </div>

      <Card className={workspacePanelCard}>
        <CardHeader>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            Marketing copy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {listing.summary ||
          listing.description ||
          listing.locationCopy ||
          listing.keyPoints.length > 0 ? (
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
              {listing.keyPoints.length > 0 ? (
                <div>
                  <p className="text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                    Key selling points
                  </p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-sm text-[var(--workspace-shell-text)]/70">
                    {listing.keyPoints.map((point) => (
                      <li key={point}>{point}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No marketing copy yet. Use Edit to add summary, description,
              location and key points.
            </p>
          )}
        </CardContent>
      </Card>

      <ListingFormModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        accountId={accountId}
        listing={listing}
        onSaved={onSaved}
      />
    </div>
  );
}

export function ListingMediaPageSection({
  accountId,
  listingId,
  media,
}: {
  accountId: string;
  listingId: string;
  media: CommercialListingMedia[];
}) {
  return (
    <ListingMediaSection
      accountId={accountId}
      listingId={listingId}
      initialMedia={media}
    />
  );
}

export function ListingInterestSection({
  accountId,
  listingId,
  enquiries: initial,
}: {
  accountId: string;
  listingId: string;
  enquiries: CommercialEnquiry[];
}) {
  const router = useRouter();
  const [enquiries, setEnquiries] = useState(initial);
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [message, setMessage] = useState('');
  const [source, setSource] = useState<EnquirySource>('manual');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setEnquiries(initial);
  }, [initial]);

  const setStatus = (enquiryId: string, status: EnquiryStatus) => {
    startTransition(async () => {
      try {
        const updated = await updateListingEnquiry({
          enquiryId,
          accountId,
          status,
        });
        setEnquiries((prev) =>
          prev.map((item) => (item.id === enquiryId ? updated : item)),
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Update failed');
      }
    });
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactName.trim() && !contactEmail.trim()) {
      setError('Add a contact name or email');
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        const created = await createListingEnquiry({
          accountId,
          listingId,
          contactName: contactName.trim() || null,
          contactEmail: contactEmail.trim() || null,
          contactPhone: contactPhone.trim() || null,
          message: message.trim() || null,
          source,
          status: 'unactioned',
        });
        setEnquiries((prev) => [created, ...prev]);
        setAddOpen(false);
        setContactName('');
        setContactEmail('');
        setContactPhone('');
        setMessage('');
        setSource('manual');
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Create failed');
      }
    });
  };

  const active = enquiries.filter((e) => e.status !== 'archived');
  const archived = enquiries.filter((e) => e.status === 'archived');

  return (
    <div className="space-y-6">
      <Card className={workspacePanelCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Interest
            </CardTitle>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Enquiries on this disposal. Adding one also creates a linked deal
              on the Deals board.
            </p>
          </div>
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add enquiry
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <p className="rounded-lg bg-rose-500/15 px-3 py-2 text-sm text-rose-700 dark:text-rose-300">
              {error}
            </p>
          ) : null}

          {enquiries.length === 0 ? (
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              No enquiries yet. Inbound interest from portals and your website
              will appear here — or add one manually to start a deal.
            </p>
          ) : (
            <>
              <InterestGroup
                title={`Active (${active.length})`}
                items={active}
                pending={pending}
                onArchive={(id) => setStatus(id, 'archived')}
              />
              <InterestGroup
                title={`Archived (${archived.length})`}
                items={archived}
                pending={pending}
                onRestore={(id) => setStatus(id, 'unactioned')}
              />
            </>
          )}
        </CardContent>
      </Card>

      {addOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form
            onSubmit={handleAdd}
            className="w-full max-w-md space-y-4 rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-5 shadow-xl"
          >
            <h3 className="text-base font-semibold text-[var(--workspace-shell-text)]">
              Add enquiry
            </h3>
            <div className="space-y-1.5">
              <Label>Contact name</Label>
              <Input
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Email</Label>
              <Input
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <select
                value={source}
                onChange={(e) => setSource(e.target.value as EnquirySource)}
                className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
              >
                {ENQUIRY_SOURCES.map((s) => (
                  <option key={s} value={s}>
                    {ENQUIRY_SOURCE_LABELS[s]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Message</Label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
              >
                {pending ? 'Saving…' : 'Add'}
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}

function InterestGroup({
  title,
  items,
  pending,
  onArchive,
  onRestore,
}: {
  title: string;
  items: CommercialEnquiry[];
  pending: boolean;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
}) {
  if (items.length === 0) return null;

  return (
    <div className="space-y-2">
      <h4 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
        {title}
      </h4>
      <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[var(--workspace-shell-sidebar-accent)]/40 text-[11px] tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
            <tr>
              <th className="px-3 py-2 font-medium">Contact</th>
              <th className="px-3 py-2 font-medium">Source</th>
              <th className="px-3 py-2 font-medium">Received</th>
              <th className="px-3 py-2 font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map((enquiry) => (
              <tr
                key={enquiry.id}
                className="border-t border-[color:var(--workspace-shell-border)]"
              >
                <td className="px-3 py-2.5">
                  <div className="font-medium text-[var(--workspace-shell-text)]">
                    {enquiry.contactName || 'Unknown'}
                  </div>
                  {enquiry.contactEmail ? (
                    <div className="text-xs text-[var(--workspace-shell-text)]/45">
                      {enquiry.contactEmail}
                    </div>
                  ) : null}
                  {enquiry.message ? (
                    <div className="mt-1 line-clamp-2 text-xs text-[var(--workspace-shell-text)]/55">
                      {enquiry.message}
                    </div>
                  ) : null}
                </td>
                <td className="px-3 py-2.5 text-[var(--workspace-shell-text)]/70">
                  {ENQUIRY_SOURCE_LABELS[enquiry.source as EnquirySource] ??
                    enquiry.source}
                </td>
                <td className="px-3 py-2.5 text-[var(--workspace-shell-text)]/70">
                  {new Date(enquiry.receivedAt).toLocaleDateString('en-GB')}
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex flex-wrap gap-1.5">
                    {onArchive ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onArchive(enquiry.id)}
                      >
                        Archive
                      </Button>
                    ) : null}
                    {onRestore ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onRestore(enquiry.id)}
                      >
                        Restore
                      </Button>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function ListingAvailabilitySection({
  accountId,
  listingId,
  units: initialUnits,
}: {
  accountId: string;
  listingId: string;
  units: CommercialListingUnit[];
}) {
  const [units, setUnits] = useState(initialUnits);
  const [unitModalOpen, setUnitModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<CommercialListingUnit | null>(
    null,
  );
  const [, startUnitTransition] = useTransition();

  useEffect(() => {
    setUnits(initialUnits);
  }, [initialUnits]);

  return (
    <>
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
            onClick={() => {
              setEditingUnit(null);
              setUnitModalOpen(true);
            }}
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
                        unit.sizeSqft != null ? `${unit.sizeSqft} sq ft` : null,
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
                      onClick={() => {
                        setEditingUnit(unit);
                        setUnitModalOpen(true);
                      }}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-rose-400"
                      onClick={() => {
                        if (!confirm('Delete this unit?')) return;
                        startUnitTransition(async () => {
                          await deleteListingUnit({
                            unitId: unit.id,
                            accountId,
                          });
                          setUnits((prev) =>
                            prev.filter((u) => u.id !== unit.id),
                          );
                        });
                      }}
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

      <ListingUnitFormModal
        open={unitModalOpen}
        onClose={() => setUnitModalOpen(false)}
        accountId={accountId}
        listingId={listingId}
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
    </>
  );
}

export function ListingManagementSection({
  listing: initial,
  publications,
  accountId,
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
}) {
  const { listing, setListing } = useListingState(initial);
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

  return (
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
              Not published to any portals yet. Configure the Property Hive XML
              feed under Commercial Publishing.
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
              onCheckedChange={(enabled) => {
                startShareTransition(async () => {
                  const updated = await setLandlordShare({
                    listingId: listing.id,
                    accountId,
                    enabled,
                  });
                  setListing(updated);
                });
              }}
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
                onClick={async () => {
                  if (!shareUrl) return;
                  await navigator.clipboard.writeText(shareUrl);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 2000);
                }}
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
  );
}
