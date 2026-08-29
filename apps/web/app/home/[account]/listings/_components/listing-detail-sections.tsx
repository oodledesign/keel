'use client';

import { useCallback, useEffect, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  Bell,
  ChevronRight,
  Copy,
  Edit2,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { handleAiCreditsFailure } from '~/components/ai/handle-ai-credits-failure';
import pathsConfig from '~/config/paths.config';
import {
  ENQUIRY_SOURCES,
  ENQUIRY_SOURCE_LABELS,
  type EnquirySource,
  type EnquiryStatus,
  formatCommercialUseClassLabel,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import { RequirementFormModal } from '../../requirements/_components/requirement-form-modal';
import type { RequirementDraftPrefill } from '../../requirements/_lib/schema/requirements.schema';
import { draftRequirementFromEnquiry } from '../../requirements/_lib/server/requirement-draft-actions';
import { generateListingMarketingCopyAction } from '../_lib/server/listing-marketing-ai-actions';
import type {
  CommercialEnquiry,
  CommercialListing,
  CommercialListingMedia,
  CommercialListingUnit,
  CommercialPortalPublication,
  ListingParty,
} from '../_lib/server/listings.service';
import {
  createListingEnquiry,
  deleteListingUnit,
  setAutoCirculateMatches,
  setBrochureShare,
  setLandlordShare,
  updateListingEnquiry,
} from '../_lib/server/server-actions';
import { CommercialInterestPanel } from './commercial-interest-panel';
import { useDisposalAccess } from './disposal-access-context';
import { ListingBrochureDownload } from './listing-brochure-download';
import { ListingCirculateDialog } from './listing-circulate-dialog';
import { ListingCirculationLog } from './listing-circulation-log';
import { ListingFormModal } from './listing-form-modal';
import { ListingMapCard } from './listing-map-card';
import { ListingMediaSection } from './listing-media-section';
import { ListingPeopleStrip } from './listing-people-strip';
import { ListingPortalSyncCard } from './listing-portal-sync-card';
import { ListingUnitFormModal } from './listing-unit-form-modal';

function formatMoney(pence: number | null) {
  if (pence == null) return '—';
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(pence / 100);
}

function formatRentRange(fromPence: number | null, toPence: number | null) {
  if (fromPence == null && toPence == null) return '—';
  if (fromPence != null && toPence != null && fromPence !== toPence) {
    return `${formatMoney(fromPence)} – ${formatMoney(toPence)}`;
  }
  return formatMoney(fromPence ?? toPence);
}

function formatPerSqft(value: number | null) {
  if (value == null) return null;
  return `£${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })}/sq ft`;
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
  accountSlug,
  interestSummary,
  parties = [],
}: {
  listing: CommercialListing;
  accountId: string;
  accountSlug: string;
  interestSummary?: {
    active: number;
    archived: number;
    total: number;
    linkedDeals: number;
    upcomingViewings?: number;
    awaitingFeedback?: number;
  };
  parties?: ListingParty[];
}) {
  const { listing } = useListingState(initial);
  const [matchBadgeCount, setMatchBadgeCount] = useState(
    () => listing.matchCount ?? 0,
  );
  const dom = daysOnMarket(listing.onMarketAt);
  const summary = interestSummary ?? {
    active: 0,
    archived: 0,
    total: 0,
    linkedDeals: 0,
    upcomingViewings: 0,
    awaitingFeedback: 0,
  };

  const interestHref = `${pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id)}/interest`;
  const managementHref = `${pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id)}/management`;

  useEffect(() => {
    setMatchBadgeCount(listing.matchCount ?? 0);
  }, [listing.matchCount]);

  const handleMatchTotalsChange = useCallback(
    ({ linked, suggested }: { linked: number; suggested: number }) => {
      setMatchBadgeCount(linked + suggested);
    },
    [],
  );

  return (
    <div className="space-y-6">
      <ListingPeopleStrip
        accountSlug={accountSlug}
        parties={parties}
        managementHref={managementHref}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <SummaryCard
          label="Asking rent"
          value={
            listing.hideRentFromMarketing
              ? 'On application'
              : formatRentRange(
                  listing.askingRentPence,
                  listing.askingRentToPence,
                )
          }
        />
        <SummaryCard
          label="Asking price"
          value={
            listing.hidePriceFromMarketing
              ? 'On application'
              : formatMoney(listing.askingPricePence)
          }
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

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className={workspacePanelCard}>
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Interest funnel
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {(
                [
                  { label: 'Enquiries', value: summary.total },
                  { label: 'Active', value: summary.active },
                  { label: 'Linked instructions', value: summary.linkedDeals },
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

        <Card className={workspacePanelCard}>
          <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                  Matches
                </CardTitle>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--ozer-accent)] px-2.5 py-1 text-xs font-semibold text-white">
                  <Bell className="h-3.5 w-3.5" />
                  <span className="tabular-nums">{matchBadgeCount}</span>
                </span>
              </div>
              <p className="text-sm text-[var(--workspace-shell-text)]/50">
                Suggested requirement fits for this disposal.
              </p>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link href={interestHref}>
                Open Interest
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <CommercialInterestPanel
              accountId={accountId}
              mode={{ kind: 'listing', listingId: listing.id }}
              compact
              preview
              seeAllHref={interestHref}
              onMatchTotalsChange={handleMatchTotalsChange}
            />
          </CardContent>
        </Card>
      </div>

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
              <DetailItem
                label="Use class"
                value={formatCommercialUseClassLabel(listing.useClass)}
              />
              <DetailItem label="Property type" value={listing.sector} />
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
                label="Service charge"
                value={formatPerSqft(listing.serviceChargePerSqft)}
              />
              <DetailItem
                label="Rates payable"
                value={formatPerSqft(listing.ratesPayablePerSqft)}
              />
              <DetailItem
                label="Estate charge"
                value={formatPerSqft(listing.estateChargePerSqft)}
              />
              <DetailItem
                label="Hide rent"
                value={listing.hideRentFromMarketing ? 'Yes' : 'No'}
              />
              <DetailItem
                label="Hide price"
                value={listing.hidePriceFromMarketing ? 'Yes' : 'No'}
              />
              <DetailItem label="Possession" value={listing.possession} />
              <DetailItem label="Build status" value={listing.buildStatus} />
              <DetailItem
                label="Planning status"
                value={listing.planningStatus}
              />
              <DetailItem
                label="Fitted space"
                value={
                  listing.fittedSpace == null
                    ? null
                    : listing.fittedSpace
                      ? 'Yes'
                      : 'No'
                }
              />
              <DetailItem label="Insurance" value={listing.insuranceType} />
              <DetailItem
                label="Land size"
                value={
                  listing.landSizeMin == null
                    ? null
                    : [
                        listing.landSizeMin,
                        listing.landSizeMax != null &&
                        listing.landSizeMax !== listing.landSizeMin
                          ? `– ${listing.landSizeMax}`
                          : null,
                        listing.landSizeMetric,
                      ]
                        .filter(Boolean)
                        .join(' ')
                }
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
  const { canEditDisposals } = useDisposalAccess();
  const {
    reportExhausted,
    accountId: creditsAccountId,
    billingHref,
  } = useAiCreditsExhausted();
  const { listing, modalOpen, setModalOpen, onSaved } =
    useListingState(initial);
  const [generating, startGenerate] = useTransition();
  const [marketingOverrides, setMarketingOverrides] = useState<{
    summary: string;
    description: string;
    locationCopy: string;
    keyPoints: string[];
  } | null>(null);

  const generateCopy = () => {
    startGenerate(async () => {
      try {
        const copy = await generateListingMarketingCopyAction({
          accountId,
          listingId: listing.id,
        });
        setMarketingOverrides(copy);
        setModalOpen(true);
        toast.success('Draft marketing copy ready — review and save');
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not generate marketing copy';
        if (
          handleAiCreditsFailure(reportExhausted, {
            accountId: creditsAccountId || accountId,
            billingHref,
            message,
          })
        ) {
          return;
        }
        toast.error(message);
      }
    });
  };

  return (
    <div className="space-y-6">
      {canEditDisposals ? (
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={generating}
            onClick={generateCopy}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'Generating…' : 'Generate with AI'}
          </Button>
          <Button
            onClick={() => {
              setMarketingOverrides(null);
              setModalOpen(true);
            }}
            className={workspaceBtnPrimaryMd}
          >
            <Edit2 className="h-4 w-4" />
            Edit marketing
          </Button>
        </div>
      ) : null}

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
              No marketing copy yet. Generate with AI or use Edit to add
              summary, description, location and key points.
            </p>
          )}
        </CardContent>
      </Card>

      <ListingFormModal
        open={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setMarketingOverrides(null);
        }}
        accountId={accountId}
        listing={listing}
        marketingOverrides={marketingOverrides}
        onSaved={(next) => {
          onSaved(next);
          setMarketingOverrides(null);
        }}
      />
    </div>
  );
}

export function ListingMediaPageSection({
  accountId,
  listingId,
  media,
  websiteUrl,
}: {
  accountId: string;
  listingId: string;
  media: CommercialListingMedia[];
  websiteUrl?: string | null;
}) {
  return (
    <ListingMediaSection
      accountId={accountId}
      listingId={listingId}
      initialMedia={media}
      initialWebsiteUrl={websiteUrl}
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
  const { canEditDisposals } = useDisposalAccess();
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
  const [reqModalOpen, setReqModalOpen] = useState(false);
  const [reqDraft, setReqDraft] = useState<RequirementDraftPrefill | null>(
    null,
  );
  const [sourceEnquiryId, setSourceEnquiryId] = useState<string | null>(null);

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

  const draftFromEnquiry = (enquiryId: string) => {
    setError(null);
    startTransition(async () => {
      try {
        const draft = await draftRequirementFromEnquiry({
          accountId,
          enquiryId,
        });
        setReqDraft(draft);
        setSourceEnquiryId(enquiryId);
        setReqModalOpen(true);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Could not draft requirement';
        setError(message);
        toast.error(message);
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
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-[var(--workspace-shell-text-muted)]">
          Match contacts, then circulate particulars from this workspace.
        </p>
        {canEditDisposals ? (
          <ListingCirculateDialog accountId={accountId} listingId={listingId} />
        ) : null}
      </div>

      <CommercialInterestPanel
        accountId={accountId}
        mode={{ kind: 'listing', listingId }}
      />

      <Card className={workspacePanelCard}>
        <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
          <div>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Enquiries
            </CardTitle>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Inbound enquiries on this disposal. Link requirements above for
              the Interest Schedule.
            </p>
          </div>
          {canEditDisposals ? (
            <Button
              type="button"
              className={workspaceBtnPrimaryMd}
              onClick={() => setAddOpen(true)}
            >
              <Plus className="h-4 w-4" />
              Add enquiry
            </Button>
          ) : null}
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
              will appear here — or add one manually.
            </p>
          ) : (
            <>
              <InterestGroup
                title={`Active (${active.length})`}
                items={active}
                pending={pending}
                onArchive={
                  canEditDisposals
                    ? (id) => setStatus(id, 'archived')
                    : undefined
                }
                onDraftRequirement={
                  canEditDisposals ? draftFromEnquiry : undefined
                }
              />
              <InterestGroup
                title={`Archived (${archived.length})`}
                items={archived}
                pending={pending}
                onRestore={
                  canEditDisposals
                    ? (id) => setStatus(id, 'unactioned')
                    : undefined
                }
              />
            </>
          )}
        </CardContent>
      </Card>

      <RequirementFormModal
        open={reqModalOpen}
        onClose={() => {
          setReqModalOpen(false);
          setReqDraft(null);
          setSourceEnquiryId(null);
        }}
        accountId={accountId}
        initialDraft={reqDraft}
        sourceEnquiryId={sourceEnquiryId}
        onSaved={() => {
          setReqModalOpen(false);
          setReqDraft(null);
          setSourceEnquiryId(null);
          router.refresh();
        }}
      />

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
  onDraftRequirement,
}: {
  title: string;
  items: CommercialEnquiry[];
  pending: boolean;
  onArchive?: (id: string) => void;
  onRestore?: (id: string) => void;
  onDraftRequirement?: (id: string) => void;
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
                  {enquiry.requirementId ? (
                    <div className="mt-1 text-[11px] text-emerald-700 dark:text-emerald-400">
                      Linked to requirement
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
                    {onDraftRequirement && !enquiry.requirementId ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => onDraftRequirement(enquiry.id)}
                      >
                        <Sparkles className="h-3.5 w-3.5" />
                        Draft requirement
                      </Button>
                    ) : null}
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
  const { canEditDisposals } = useDisposalAccess();
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
          {canEditDisposals ? (
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
          ) : null}
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
                      {' '}
                      {[
                        unit.floorOrUnit,
                        unit.sizeSqft != null ? `${unit.sizeSqft} sq ft` : null,
                        unit.askingRentPence != null
                          ? formatMoney(unit.askingRentPence)
                          : unit.rentPerSqft != null
                            ? `£${unit.rentPerSqft}/sq ft`
                            : null,
                        unit.status,
                        unit.epcBand ? `EPC ${unit.epcBand}` : null,
                      ]
                        .filter(Boolean)
                        .join(' · ') || '—'}
                    </p>
                  </div>
                  {canEditDisposals ? (
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
                              prev.filter((row) => row.id !== unit.id),
                            );
                          });
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : null}
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
  accountSlug,
}: {
  listing: CommercialListing;
  publications: CommercialPortalPublication[];
  accountId: string;
  accountSlug: string;
}) {
  const { canEditDisposals } = useDisposalAccess();
  const { listing, setListing } = useListingState(initial);
  const [sharePending, startShareTransition] = useTransition();
  const [brochurePending, startBrochureTransition] = useTransition();
  const [autoCirculatePending, startAutoCirculateTransition] = useTransition();
  const [copied, setCopied] = useState(false);
  const [brochureCopied, setBrochureCopied] = useState(false);

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

  const brochurePath = listing.brochureShareToken
    ? pathsConfig.app.brochureShare.replace(
        '[token]',
        listing.brochureShareToken,
      )
    : null;
  const brochureUrl =
    typeof window !== 'undefined' && brochurePath
      ? `${window.location.origin}${brochurePath}`
      : brochurePath;

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <ListingPortalSyncCard
        listing={listing}
        publications={publications}
        accountId={accountId}
      />

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
              disabled={sharePending || !canEditDisposals}
              onCheckedChange={(enabled) => {
                if (!canEditDisposals) return;
                startShareTransition(async () => {
                  try {
                    const updated = await setLandlordShare({
                      listingId: listing.id,
                      accountId,
                      enabled,
                    });
                    setListing(updated);
                  } catch (error) {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not update landlord share',
                    );
                  }
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

      <Card className={`${workspacePanelCard} md:col-span-2`}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base text-[var(--workspace-shell-text)]">
            <Link2 className="h-4 w-4" />
            Brochures & sharing
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Online brochure share
                </p>
                <p className="text-sm text-[var(--workspace-shell-text)]/60">
                  Branded photo slideshow at an Ozer link (enquiries come back
                  here). This is not publishing to Rightmove or other portals.
                </p>
              </div>
              <Switch
                checked={listing.brochureShareEnabled}
                disabled={brochurePending || !canEditDisposals}
                onCheckedChange={(enabled) => {
                  if (!canEditDisposals) return;
                  startBrochureTransition(async () => {
                    try {
                      const updated = await setBrochureShare({
                        listingId: listing.id,
                        accountId,
                        enabled,
                      });
                      setListing(updated);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not update brochure share',
                      );
                    }
                  });
                }}
              />
            </div>
            {listing.brochureShareEnabled && brochurePath ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 truncate rounded-md bg-[var(--workspace-shell-sidebar-accent)] px-2 py-1.5 text-xs text-[var(--workspace-shell-text)]/70">
                  {brochureUrl ?? brochurePath}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    if (!brochureUrl) return;
                    await navigator.clipboard.writeText(brochureUrl);
                    setBrochureCopied(true);
                    setTimeout(() => setBrochureCopied(false), 2000);
                  }}
                  className="shrink-0 gap-1.5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  {brochureCopied ? 'Copied' : 'Copy'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  asChild
                  className="shrink-0"
                >
                  <a href={brochurePath} target="_blank" rel="noreferrer">
                    Open
                  </a>
                </Button>
              </div>
            ) : null}
          </div>

          <div className="border-t border-[var(--workspace-shell-border)] pt-3">
            <p className="mb-1 text-sm font-medium text-[var(--workspace-shell-text)]">
              PDF brochure
            </p>
            <ListingBrochureDownload
              listingId={listing.id}
              accountId={accountId}
              accountSlug={accountSlug}
              listingName={listing.name}
              listingAddress={[
                listing.addressLine1,
                listing.town,
                listing.postcode,
              ]
                .filter(Boolean)
                .join(', ')}
              coverUrl={listing.coverUrl}
              defaultShowRent={!listing.hideRentFromMarketing}
              defaultShowPrice={!listing.hidePriceFromMarketing}
            />
          </div>

          <div className="rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/40 px-3 py-2.5 text-sm text-[var(--workspace-shell-text)]/70">
            <p className="font-medium text-[var(--workspace-shell-text)]">
              Portals (Rightmove, etc.)
            </p>
            <p className="mt-0.5">
              Use <span className="font-medium">Publish</span> in the brochure
              drawer (or upload under Media → Brochure), then republish from
              Portal publishing. Online brochure share is a separate Ozer link.
            </p>
          </div>

          <div className="border-t border-[var(--workspace-shell-border)] pt-3">
            <p className="mb-2 text-sm font-medium text-[var(--workspace-shell-text)]">
              Circulate to requirements
            </p>
            <p className="mb-2 text-sm text-[var(--workspace-shell-text)]/60">
              Email matching applicants via Amazon SES as this workspace, not
              Ozer. From name, logo, and colours come from Brand settings.
            </p>
            <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-[color:var(--workspace-shell-border)] px-3 py-2">
              <div>
                <p className="text-sm text-[var(--workspace-shell-text)]">
                  Auto-circulate new matches
                </p>
                <p className="text-xs text-[var(--workspace-shell-text)]/60">
                  Daily cron mails subscribed applicants who have not already
                  received this disposal.
                </p>
              </div>
              <Switch
                checked={listing.autoCirculateMatches}
                disabled={autoCirculatePending || !canEditDisposals}
                onCheckedChange={(enabled) => {
                  if (!canEditDisposals) return;
                  startAutoCirculateTransition(async () => {
                    try {
                      const updated = await setAutoCirculateMatches({
                        listingId: listing.id,
                        accountId,
                        enabled,
                      });
                      setListing(updated);
                    } catch (error) {
                      toast.error(
                        error instanceof Error
                          ? error.message
                          : 'Could not update auto-circulate',
                      );
                    }
                  });
                }}
              />
            </div>
            {canEditDisposals ? (
              <ListingCirculateDialog
                accountId={accountId}
                listingId={listing.id}
              />
            ) : null}
            {canEditDisposals ? (
              <div className="mt-4">
                <p className="mb-2 text-sm font-medium text-[var(--workspace-shell-text)]">
                  Send log
                </p>
                <ListingCirculationLog
                  accountId={accountId}
                  listingId={listing.id}
                />
              </div>
            ) : null}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
