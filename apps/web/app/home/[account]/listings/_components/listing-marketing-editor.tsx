'use client';

import { useMemo, useState, useTransition } from 'react';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import {
  ArrowDown,
  ArrowUp,
  Building2,
  Check,
  ChevronRight,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import { toast } from '@kit/ui/sonner';
import { Switch } from '@kit/ui/switch';
import { Textarea } from '@kit/ui/textarea';

import { useAiCreditsExhausted } from '~/components/ai/ai-credits-exhausted-context';
import { handleAiCreditsFailure } from '~/components/ai/handle-ai-credits-failure';
import { ListingStatusBadge } from '~/components/commercial/listing-status-badge';
import pathsConfig from '~/config/paths.config';
import { isEachFeedIncluded } from '~/lib/commercial/each-feed-inclusion';
import { getMarketingReadiness } from '~/lib/commercial/marketing-readiness';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import {
  MARKETING_SECTION_KINDS,
  MARKETING_SECTION_KIND_LABELS,
  type MarketingSectionKind,
  SUGGESTED_LISTING_AMENITIES,
} from '../_lib/schema/listings.schema';
import { generateListingMarketingCopyAction } from '../_lib/server/listing-marketing-ai-actions';
import type {
  CommercialListing,
  CommercialPortalPublication,
  ListingAssignment,
  ListingCoAgent,
  ListingMemberOption,
  WorkspaceTeam,
} from '../_lib/server/listings.service';
import { setBrochureShare, updateListing } from '../_lib/server/server-actions';
import {
  ListingAssignmentCard,
  type ListingBranchOption,
} from './listing-assignment-card';
import { ListingBrochureDownload } from './listing-brochure-download';
import { ListingCoAgentsCard } from './listing-co-agents-card';
import { ListingEachFeedToggle } from './listing-each-feed-toggle';
import {
  MarketingReadinessCard,
  confirmPublishIfNotReady,
} from './marketing-readiness-card';

const SUMMARY_MAX = 140;

type MarketingSection = CommercialListing['marketingSections'][number];

type KeyPointItem = { id: string; text: string };

function toKeyPointItems(points: string[]): KeyPointItem[] {
  return points.map((text) => ({
    id: `kp_${Math.random().toString(36).slice(2, 10)}`,
    text,
  }));
}

function newSectionId() {
  return `sec_${Math.random().toString(36).slice(2, 10)}`;
}

function moveItem<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return items;
  const tmp = next[index]!;
  next[index] = next[target]!;
  next[target] = tmp;
  return next;
}

export function ListingMarketingEditor({
  listing: initial,
  accountId,
  accountSlug,
  members,
  teams,
  branches,
  assignment,
  coAgents,
  publications,
  media = [],
}: {
  listing: CommercialListing;
  accountId: string;
  accountSlug: string;
  members: ListingMemberOption[];
  teams: WorkspaceTeam[];
  branches: ListingBranchOption[];
  assignment: ListingAssignment;
  coAgents: ListingCoAgent[];
  publications: CommercialPortalPublication[];
  media?: import('../_lib/server/listings.service').CommercialListingMedia[];
}) {
  const router = useRouter();
  const {
    reportExhausted,
    accountId: creditsAccountId,
    billingHref,
  } = useAiCreditsExhausted();

  const [listing, setListing] = useState(initial);
  const [form, setForm] = useState({
    summary: initial.summary ?? '',
    keyPoints: toKeyPointItems(initial.keyPoints),
    amenities: initial.amenities,
    parkingAvailable: initial.parkingAvailable,
    parkingSpaces:
      initial.parkingSpaces != null ? String(initial.parkingSpaces) : '',
    description: initial.description ?? '',
    locationCopy: initial.locationCopy ?? '',
    sections: initial.marketingSections,
    hideRent: initial.hideRentFromMarketing,
    hidePrice: initial.hidePriceFromMarketing,
  });
  const [showAllAmenities, setShowAllAmenities] = useState(false);
  const [customAmenity, setCustomAmenity] = useState('');
  const [newKeyPoint, setNewKeyPoint] = useState('');
  const [pending, startTransition] = useTransition();
  const [generating, startGenerate] = useTransition();
  const [brochurePending, startBrochure] = useTransition();

  const {
    summary,
    keyPoints,
    amenities,
    parkingAvailable,
    parkingSpaces,
    description,
    locationCopy,
    sections,
    hideRent,
    hidePrice,
  } = form;

  const availabilityHref = pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listing.id)
    .concat('/availability');

  const publishingHref =
    pathsConfig.app.accountCommercialPublishing?.replace(
      '[account]',
      accountSlug,
    ) ?? `/home/${accountSlug}/commercial-publishing`;

  const suggestedAmenities = useMemo(() => {
    const all = [...SUGGESTED_LISTING_AMENITIES];
    return showAllAmenities ? all : all.slice(0, 5);
  }, [showAllAmenities]);

  const unusedSectionKinds = MARKETING_SECTION_KINDS.filter(
    (kind) => kind === 'custom' || !sections.some((s) => s.kind === kind),
  );

  const saveMarketing = (patch: {
    summary?: string | null;
    keyPoints?: string[];
    amenities?: string[];
    parkingAvailable?: boolean;
    parkingSpaces?: number | null;
    description?: string | null;
    locationCopy?: string | null;
    marketingSections?: MarketingSection[];
    hideRentFromMarketing?: boolean;
    hidePriceFromMarketing?: boolean;
  }) => {
    startTransition(async () => {
      try {
        const updated = await updateListing({
          accountId,
          listingId: listing.id,
          ...patch,
        });
        setListing(updated);
        setForm((current) => ({
          ...current,
          summary: updated.summary ?? '',
          keyPoints: toKeyPointItems(updated.keyPoints),
          amenities: updated.amenities,
          parkingAvailable: updated.parkingAvailable,
          parkingSpaces:
            updated.parkingSpaces != null ? String(updated.parkingSpaces) : '',
          description: updated.description ?? '',
          locationCopy: updated.locationCopy ?? '',
          sections: updated.marketingSections,
          hideRent: updated.hideRentFromMarketing,
          hidePrice: updated.hidePriceFromMarketing,
        }));
        toast.success('Marketing saved');
        router.refresh();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not save marketing',
        );
      }
    });
  };

  const generateCopy = () => {
    startGenerate(async () => {
      try {
        const copy = await generateListingMarketingCopyAction({
          accountId,
          listingId: listing.id,
        });
        setForm((current) => ({
          ...current,
          summary: (copy.summary ?? '').slice(0, SUMMARY_MAX),
          description: copy.description ?? '',
          locationCopy: copy.locationCopy ?? '',
          keyPoints: toKeyPointItems(copy.keyPoints ?? []),
        }));
        toast.success('Draft ready — review and save');
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

  const addAmenity = (label: string) => {
    const next = label.trim();
    if (!next || amenities.includes(next)) return;
    setForm((current) => ({
      ...current,
      amenities: [...current.amenities, next],
    }));
  };

  const addSection = (kind: MarketingSectionKind) => {
    const title = MARKETING_SECTION_KIND_LABELS[kind];
    setForm((current) => ({
      ...current,
      sections: [
        ...current.sections,
        { id: newSectionId(), kind, title, body: '' },
      ],
    }));
  };

  return (
    <div
      className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]"
      data-tour="sop-listing-marketing"
    >
      <div className="space-y-6">
        <div className="flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={generating || pending}
            onClick={generateCopy}
          >
            {generating ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            {generating ? 'Generating…' : 'Generate with AI'}
          </Button>
        </div>

        <Card
          id="summary-key-points"
          className={`${workspacePanelCard} scroll-mt-36`}
        >
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Summary & key points
            </CardTitle>
            <p className="text-sm text-[var(--workspace-shell-text)]/50">
              One or two sentences that describe this property for the public.
            </p>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Textarea
                value={summary}
                maxLength={SUMMARY_MAX}
                rows={3}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    summary: e.target.value.slice(0, SUMMARY_MAX),
                  }))
                }
                placeholder="FREEHOLD MIXED-USE INVESTMENT FOR SALE…"
                className="bg-[var(--workspace-shell-panel)]"
              />
              <p className="text-right text-xs text-[var(--workspace-shell-text)]/45">
                {summary.length} / {SUMMARY_MAX}
              </p>
            </div>

            <div className="space-y-2">
              <Label>Key selling points</Label>
              <ul className="divide-y divide-[color:var(--workspace-shell-border)] rounded-lg border border-[color:var(--workspace-shell-border)]">
                {keyPoints.length === 0 ? (
                  <li className="px-3 py-4 text-sm text-[var(--workspace-shell-text)]/45">
                    No key points yet
                  </li>
                ) : (
                  keyPoints.map((point, index) => (
                    <li
                      key={point.id}
                      className="flex items-center gap-2 px-2 py-2"
                    >
                      <div className="flex flex-col">
                        <button
                          type="button"
                          className="text-[var(--workspace-shell-text)]/40 hover:text-[var(--workspace-shell-text)]"
                          aria-label="Move up"
                          disabled={index === 0}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              keyPoints: moveItem(current.keyPoints, index, -1),
                            }))
                          }
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          className="text-[var(--workspace-shell-text)]/40 hover:text-[var(--workspace-shell-text)]"
                          aria-label="Move down"
                          disabled={index === keyPoints.length - 1}
                          onClick={() =>
                            setForm((current) => ({
                              ...current,
                              keyPoints: moveItem(current.keyPoints, index, 1),
                            }))
                          }
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <Input
                        value={point.text}
                        onChange={(e) => {
                          const value = e.target.value;
                          setForm((current) => ({
                            ...current,
                            keyPoints: current.keyPoints.map((item, i) =>
                              i === index ? { ...item, text: value } : item,
                            ),
                          }));
                        }}
                        className="bg-[var(--workspace-shell-panel)]"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            keyPoints: current.keyPoints.filter(
                              (_, i) => i !== index,
                            ),
                          }))
                        }
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </li>
                  ))
                )}
              </ul>
              <div className="flex gap-2">
                <Input
                  value={newKeyPoint}
                  placeholder="Add key selling point"
                  onChange={(e) => setNewKeyPoint(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      const next = newKeyPoint.trim();
                      if (!next) return;
                      setForm((current) => ({
                        ...current,
                        keyPoints: [
                          ...current.keyPoints,
                          ...toKeyPointItems([next]),
                        ],
                      }));
                      setNewKeyPoint('');
                    }
                  }}
                  className="bg-[var(--workspace-shell-panel)]"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    const next = newKeyPoint.trim();
                    if (!next) return;
                    setForm((current) => ({
                      ...current,
                      keyPoints: [
                        ...current.keyPoints,
                        ...toKeyPointItems([next]),
                      ],
                    }));
                    setNewKeyPoint('');
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
                onClick={() =>
                  saveMarketing({
                    summary: summary.trim() || null,
                    keyPoints: keyPoints
                      .map((p) => p.text.trim())
                      .filter(Boolean),
                  })
                }
              >
                {pending ? 'Saving…' : 'Save summary'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card id="amenities" className={`${workspacePanelCard} scroll-mt-36`}>
          <CardHeader className="flex flex-row items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base text-[var(--workspace-shell-text)]">
                Amenities & specifications
              </CardTitle>
              <p className="text-sm text-[var(--workspace-shell-text)]/50">
                Highlight features used in marketing materials.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowAllAmenities((v) => !v)}
            >
              {showAllAmenities ? 'Show less' : 'View all'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-3">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                    Parking
                  </p>
                  <p className="text-xs text-[var(--workspace-shell-text)]/50">
                    Sent to Rightmove as amenity PARKING
                    {parkingAvailable ? ' (+ optional space count)' : ''}.
                  </p>
                </div>
                <Switch
                  checked={parkingAvailable}
                  disabled={pending}
                  onCheckedChange={(checked) =>
                    setForm((current) => ({
                      ...current,
                      parkingAvailable: checked,
                      parkingSpaces: checked ? current.parkingSpaces : '',
                    }))
                  }
                />
              </div>
              {parkingAvailable ? (
                <div className="mt-3 max-w-[180px] space-y-1.5">
                  <Label htmlFor="parking-spaces">Number of spaces</Label>
                  <Input
                    id="parking-spaces"
                    type="number"
                    min={0}
                    inputMode="numeric"
                    placeholder="Optional"
                    value={parkingSpaces}
                    disabled={pending}
                    onChange={(e) =>
                      setForm((current) => ({
                        ...current,
                        parkingSpaces: e.target.value,
                      }))
                    }
                    className="bg-[var(--workspace-shell-panel)]"
                  />
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-2">
              {suggestedAmenities.map((label) => {
                const selected = amenities.includes(label);
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() =>
                      selected
                        ? setForm((current) => ({
                            ...current,
                            amenities: current.amenities.filter(
                              (item) => item !== label,
                            ),
                          }))
                        : addAmenity(label)
                    }
                    className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      selected
                        ? 'bg-[var(--ozer-accent)] text-white'
                        : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:text-[var(--workspace-shell-text)]'
                    }`}
                  >
                    {selected ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <Plus className="h-3 w-3" />
                    )}
                    {label}
                  </button>
                );
              })}
            </div>

            <div>
              <p className="mb-2 text-xs tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                Selected
              </p>
              {amenities.length === 0 ? (
                <p className="text-sm text-[var(--workspace-shell-text)]/45">
                  No amenities or specifications selected.
                </p>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {amenities.map((label) => (
                    <span
                      key={label}
                      className="inline-flex items-center gap-1 rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2.5 py-1 text-xs text-[var(--workspace-shell-text)]"
                    >
                      {label}
                      <button
                        type="button"
                        aria-label={`Remove ${label}`}
                        onClick={() =>
                          setForm((current) => ({
                            ...current,
                            amenities: current.amenities.filter(
                              (item) => item !== label,
                            ),
                          }))
                        }
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2">
              <Input
                value={customAmenity}
                placeholder="Add custom amenity"
                onChange={(e) => setCustomAmenity(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addAmenity(customAmenity);
                    setCustomAmenity('');
                  }
                }}
                className="bg-[var(--workspace-shell-panel)]"
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  addAmenity(customAmenity);
                  setCustomAmenity('');
                }}
              >
                Add
              </Button>
            </div>

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
                onClick={() => {
                  const trimmed = parkingSpaces.trim();
                  const spaces =
                    trimmed === '' ? null : Number.parseInt(trimmed, 10);
                  if (
                    parkingAvailable &&
                    trimmed !== '' &&
                    (!Number.isFinite(spaces) || (spaces ?? 0) < 0)
                  ) {
                    toast.error('Parking spaces must be a whole number ≥ 0');
                    return;
                  }
                  saveMarketing({
                    amenities,
                    parkingAvailable,
                    parkingSpaces: parkingAvailable ? spaces : null,
                  });
                }}
              >
                {pending ? 'Saving…' : 'Save amenities'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          id="marketing-text"
          className={`${workspacePanelCard} scroll-mt-36`}
        >
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Marketing text
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="marketing-description">Description</Label>
              <Textarea
                id="marketing-description"
                rows={6}
                value={description}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    description: e.target.value,
                  }))
                }
                className="bg-[var(--workspace-shell-panel)]"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="marketing-location">Location</Label>
              <Textarea
                id="marketing-location"
                rows={4}
                value={locationCopy}
                onChange={(e) =>
                  setForm((current) => ({
                    ...current,
                    locationCopy: e.target.value,
                  }))
                }
                className="bg-[var(--workspace-shell-panel)]"
              />
            </div>

            {sections.map((section, index) => (
              <div
                key={section.id}
                className="space-y-2 rounded-lg border border-[color:var(--workspace-shell-border)] p-3"
              >
                <div className="flex items-center gap-2">
                  <Input
                    value={section.title}
                    onChange={(e) => {
                      const title = e.target.value;
                      setForm((current) => ({
                        ...current,
                        sections: current.sections.map((item, i) =>
                          i === index ? { ...item, title } : item,
                        ),
                      }));
                    }}
                    className="bg-[var(--workspace-shell-panel)]"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      setForm((current) => ({
                        ...current,
                        sections: current.sections.filter(
                          (_, i) => i !== index,
                        ),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                <Textarea
                  rows={4}
                  value={section.body}
                  onChange={(e) => {
                    const body = e.target.value;
                    setForm((current) => ({
                      ...current,
                      sections: current.sections.map((item, i) =>
                        i === index ? { ...item, body } : item,
                      ),
                    }));
                  }}
                  className="bg-[var(--workspace-shell-panel)]"
                />
              </div>
            ))}

            {unusedSectionKinds.length > 0 ? (
              <div className="space-y-2">
                <p className="text-xs tracking-wide text-[var(--workspace-shell-text)]/45 uppercase">
                  Add more text
                </p>
                <div className="flex flex-wrap gap-2">
                  {unusedSectionKinds.map((kind) => (
                    <Button
                      key={kind}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addSection(kind)}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      {MARKETING_SECTION_KIND_LABELS[kind]}
                    </Button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="flex justify-end">
              <Button
                type="button"
                disabled={pending}
                className={workspaceBtnPrimaryMd}
                onClick={() =>
                  saveMarketing({
                    description: description.trim() || null,
                    locationCopy: locationCopy.trim() || null,
                    marketingSections: sections
                      .map((section) => ({
                        ...section,
                        title: section.title.trim(),
                        body: section.body,
                      }))
                      .filter((section) => section.title.length > 0),
                  })
                }
              >
                {pending ? 'Saving…' : 'Save marketing text'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card
          id="accommodation"
          className={`${workspacePanelCard} scroll-mt-36`}
        >
          <CardHeader>
            <CardTitle className="text-base text-[var(--workspace-shell-text)]">
              Accommodation
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-[var(--workspace-shell-text)]/60">
              Include an accommodation schedule in marketing outputs by adding
              floors / units on Availability.
            </p>
            <Button asChild variant="outline">
              <Link href={availabilityHref}>
                <Building2 className="h-4 w-4" />
                Update availability
                <ChevronRight className="h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <div
          id="agent-contacts"
          className="grid scroll-mt-36 gap-4 xl:grid-cols-2"
        >
          <ListingAssignmentCard
            accountId={accountId}
            accountSlug={accountSlug}
            members={members}
            teams={teams}
            branches={branches}
            assignment={assignment}
          />
          <ListingCoAgentsCard
            accountId={accountId}
            listingId={listing.id}
            initialCoAgents={coAgents}
          />
        </div>
      </div>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <MarketingReadinessCard
          listing={listing}
          accountSlug={accountSlug}
          media={media}
          publications={publications}
          readiness={getMarketingReadiness({
            listing: {
              ...listing,
              summary,
              keyPoints: keyPoints.map((p) => p.text.trim()).filter(Boolean),
            },
            media,
            publications,
          })}
        />

        <Card
          id="publish-options"
          className={`${workspacePanelCard} scroll-mt-36`}
        >
          <CardHeader>
            <CardTitle className="text-sm text-[var(--workspace-shell-text)]">
              Publish options
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="text-[var(--workspace-shell-text)]/70">
                Status
              </span>
              <span className="font-medium text-[var(--workspace-shell-text)]">
                <ListingStatusBadge status={listing.status} />
              </span>
            </div>

            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <span className="text-sm text-[var(--workspace-shell-text)]/70">
                  Online brochure share
                </span>
                <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                  Public Ozer slideshow link — not a portal listing.
                </p>
              </div>
              <Switch
                checked={listing.brochureShareEnabled}
                disabled={brochurePending}
                onCheckedChange={(enabled) => {
                  startBrochure(async () => {
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

            <div className="border-t border-[var(--workspace-shell-border)] pt-4">
              <p className="mb-1 text-sm font-medium text-[var(--workspace-shell-text)]">
                PDF brochure
              </p>
              <p className="mb-2 text-xs text-[var(--workspace-shell-text-muted)]">
                Preview, publish to Media for portals, or upload an external
                PDF.
              </p>
              <ListingBrochureDownload
                listingId={listing.id}
                accountId={accountId}
                accountSlug={accountSlug}
                listingName={listing.name}
                listingAddress={[listing.town, listing.postcode]
                  .filter(Boolean)
                  .join(', ')}
                coverUrl={listing.coverUrl}
                defaultShowRent={!listing.hideRentFromMarketing}
                defaultShowPrice={!listing.hidePriceFromMarketing}
                compact
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--workspace-shell-text)]/70">
                Hide rent (POA)
              </span>
              <Switch
                checked={hideRent}
                disabled={pending}
                onCheckedChange={(enabled) => {
                  setForm((current) => ({ ...current, hideRent: enabled }));
                  saveMarketing({ hideRentFromMarketing: enabled });
                }}
              />
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="text-sm text-[var(--workspace-shell-text)]/70">
                Hide price (POA)
              </span>
              <Switch
                checked={hidePrice}
                disabled={pending}
                onCheckedChange={(enabled) => {
                  setForm((current) => ({ ...current, hidePrice: enabled }));
                  saveMarketing({ hidePriceFromMarketing: enabled });
                }}
              />
            </div>

            <ListingEachFeedToggle
              accountId={accountId}
              listingId={listing.id}
              initialEnabled={isEachFeedIncluded(publications)}
              onBeforeEnable={() =>
                confirmPublishIfNotReady(
                  getMarketingReadiness({
                    listing: {
                      ...listing,
                      summary,
                      keyPoints: keyPoints
                        .map((p) => p.text.trim())
                        .filter(Boolean),
                    },
                    media,
                    publications,
                  }),
                )
              }
            />

            <Button asChild variant="outline" size="sm" className="w-full">
              <Link href={publishingHref}>Portal publishing settings</Link>
            </Button>
          </CardContent>
        </Card>
      </aside>
    </div>
  );
}
