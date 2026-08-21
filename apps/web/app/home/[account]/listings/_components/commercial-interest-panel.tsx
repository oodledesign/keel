'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  ChevronRight,
  Loader2,
  MoreHorizontal,
  Plus,
  Search,
  Sparkles,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import { Checkbox } from '@kit/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { Input } from '@kit/ui/input';
import { Label } from '@kit/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import type { MatchSuggestion } from '~/home/[account]/listings/_lib/server/match-suggestions.service';
import {
  bulkCreateInterestMatches,
  createInterestMatch,
  deleteInterestMatch,
  draftInterestOutreach,
  explainInterestSuggestions,
  listMatchesForListing,
  listMatchesForRequirement,
  rankBookForRequirement,
  suggestInterestMatches,
  updateInterestMatch,
} from '~/home/[account]/listings/_lib/server/matches-actions';
import type { CommercialInterestMatch } from '~/home/[account]/listings/_lib/server/matches.service';
import { listListings } from '~/home/[account]/listings/_lib/server/server-actions';
import { listRequirements } from '~/home/[account]/requirements/_lib/server/server-actions';
import {
  COMMERCIAL_PROPERTY_TYPES,
  INTEREST_STATUSES,
  INTEREST_STATUS_LABELS,
  type InterestStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import { RequirementMatchesMap } from './requirement-matches-map';

function suggestionKey(s: MatchSuggestion) {
  return `${s.listingId}:${s.requirementId}`;
}
type Mode =
  | { kind: 'listing'; listingId: string }
  | { kind: 'requirement'; requirementId: string };

type Props = {
  accountId: string;
  mode: Mode;
  compact?: boolean;
  /** Overview preview: short suggestion list only, no schedule. */
  preview?: boolean;
  /** When compact, link to the full Interest page with total count. */
  seeAllHref?: string | null;
  /** Fires when linked interest + suggested fits totals change (for Matches badges). */
  onMatchTotalsChange?: (totals: { linked: number; suggested: number }) => void;
};

function formatSize(min: number | null, max: number | null) {
  if (min == null && max == null) return null;
  if (min != null && max != null)
    return `${min.toLocaleString()}–${max.toLocaleString()} sq ft`;
  if (min != null) return `from ${min.toLocaleString()} sq ft`;
  return `up to ${max!.toLocaleString()} sq ft`;
}

function relativeActivity(iso: string) {
  const ms = Date.now() - new Date(iso).getTime();
  const days = Math.floor(ms / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 14) return `${days} days ago`;
  return new Date(iso).toLocaleDateString('en-GB');
}

export function CommercialInterestPanel({
  accountId,
  mode,
  compact = false,
  preview = false,
  seeAllHref = null,
  onMatchTotalsChange,
}: Props) {
  const [matches, setMatches] = useState<CommercialInterestMatch[]>([]);
  const [suggestions, setSuggestions] = useState<MatchSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [pending, startTransition] = useTransition();
  const [addOpen, setAddOpen] = useState(false);
  const [pickId, setPickId] = useState('');
  const [notes, setNotes] = useState('');
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>(
    [],
  );
  const [outreach, setOutreach] = useState<{
    subject: string;
    body: string;
  } | null>(null);

  const [rankedBook, setRankedBook] = useState<MatchSuggestion[] | null>(null);
  const [rankLoading, setRankLoading] = useState(false);
  const [selectedListingIds, setSelectedListingIds] = useState<Set<string>>(
    () => new Set(),
  );

  const [sector, setSector] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [lastDays, setLastDays] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | InterestStatus>(
    'all',
  );

  const title =
    mode.kind === 'listing'
      ? 'Interested requirements'
      : 'Interested disposals';

  const loadSuggestions = async () => {
    setSuggestionsLoading(true);
    try {
      const next = await suggestInterestMatches({
        accountId,
        listingId: mode.kind === 'listing' ? mode.listingId : undefined,
        requirementId:
          mode.kind === 'requirement' ? mode.requirementId : undefined,
        // Load enough for badge totals and the full Interest list (badge can be 20+).
        limit: 40,
      });
      setSuggestions(next);
    } catch (error) {
      console.error('[interest-panel] suggestions failed', error);
    } finally {
      setSuggestionsLoading(false);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const lastDaysNum =
        lastDays === 'all' ? undefined : Number.parseInt(lastDays, 10);
      const next =
        mode.kind === 'listing'
          ? await listMatchesForListing({
              accountId,
              listingId: mode.listingId,
              lastDays: Number.isFinite(lastDaysNum) ? lastDaysNum : undefined,
              sector: sector.trim() || null,
              sizeMinSqft: sizeMin ? Number(sizeMin) : null,
              sizeMaxSqft: sizeMax ? Number(sizeMax) : null,
            })
          : await listMatchesForRequirement({
              accountId,
              requirementId: mode.requirementId,
              lastDays: Number.isFinite(lastDaysNum) ? lastDaysNum : undefined,
            });
      setMatches(next);
      void loadSuggestions();
    } catch (error) {
      console.error('[interest-panel] load failed', error);
      toast.error('Could not load interests');
    } finally {
      setLoading(false);
    }
  };

  const scopeId = mode.kind === 'listing' ? mode.listingId : mode.requirementId;

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, mode.kind, scopeId, sector, sizeMin, sizeMax, lastDays]);

  useEffect(() => {
    if (!addOpen) return;
    void (async () => {
      try {
        if (mode.kind === 'listing') {
          const requirements = await listRequirements({ accountId });
          const linked = new Set(matches.map((m) => m.requirementId));
          setOptions(
            requirements
              .filter((r) => !linked.has(r.id))
              .map((r) => ({
                id: r.id,
                label:
                  [r.companyName, r.contactName, r.locationText]
                    .filter(Boolean)
                    .join(' · ') || 'Requirement',
              })),
          );
        } else {
          const collected: Awaited<ReturnType<typeof listListings>>['data'] =
            [];
          let page = 1;
          let total = 0;
          do {
            const result = await listListings({
              accountId,
              page,
              pageSize: 100,
            });
            collected.push(...(result.data ?? []));
            total = result.total ?? collected.length;
            page += 1;
          } while (collected.length < total && page <= 50);
          const linked = new Set(matches.map((m) => m.listingId));
          setOptions(
            collected
              .filter((l) => !linked.has(l.id))
              .map((l) => ({
                id: l.id,
                label: l.name || 'Disposal',
              })),
          );
        }
      } catch (error) {
        console.error('[interest-panel] options failed', error);
      }
    })();
  }, [addOpen, accountId, mode, matches]);

  const filteredHint = useMemo(() => {
    if (mode.kind !== 'listing') return null;
    const bits = [];
    if (sector.trim()) bits.push(`property type “${sector.trim()}”`);
    if (sizeMin || sizeMax) bits.push('size band');
    if (lastDays !== 'all') bits.push(`last ${lastDays} days`);
    return bits.length ? `Filtered by ${bits.join(', ')}` : null;
  }, [mode.kind, sector, sizeMin, sizeMax, lastDays]);

  const statusCounts = useMemo(() => {
    const counts = Object.fromEntries(
      INTEREST_STATUSES.map((status) => [status, 0]),
    ) as Record<InterestStatus, number>;
    for (const match of matches) {
      const status = (INTEREST_STATUSES as readonly string[]).includes(
        match.status,
      )
        ? (match.status as InterestStatus)
        : 'new';
      counts[status] = (counts[status] ?? 0) + 1;
    }
    return counts;
  }, [matches]);

  const filteredMatches = useMemo(() => {
    if (statusFilter === 'all') return matches;
    return matches.filter((match) => match.status === statusFilter);
  }, [matches, statusFilter]);

  const visibleSuggestions = useMemo(
    () =>
      preview
        ? suggestions.slice(0, 3)
        : compact
          ? suggestions.slice(0, 5)
          : suggestions,
    [compact, preview, suggestions],
  );

  useEffect(() => {
    onMatchTotalsChange?.({
      linked: matches.length,
      suggested: suggestions.length,
    });
  }, [matches.length, suggestions.length, onMatchTotalsChange]);

  const showUnifiedEmpty =
    !loading &&
    !suggestionsLoading &&
    matches.length === 0 &&
    suggestions.length === 0;

  const onStatusChange = (matchId: string, status: InterestStatus) => {
    startTransition(async () => {
      try {
        const updated = await updateInterestMatch({
          accountId,
          matchId,
          status,
        });
        setMatches((prev) => prev.map((m) => (m.id === matchId ? updated : m)));
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not update status',
        );
      }
    });
  };

  const onAdd = () => {
    if (!pickId) {
      toast.error(
        mode.kind === 'listing' ? 'Pick a requirement' : 'Pick a disposal',
      );
      return;
    }
    startTransition(async () => {
      try {
        await createInterestMatch({
          accountId,
          listingId: mode.kind === 'listing' ? mode.listingId : pickId,
          requirementId:
            mode.kind === 'requirement' ? mode.requirementId : pickId,
          notes: notes.trim() || null,
          status: 'new',
        });
        setAddOpen(false);
        setPickId('');
        setNotes('');
        toast.success('Interest added');
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add interest',
        );
      }
    });
  };

  const onDelete = (matchId: string) => {
    startTransition(async () => {
      try {
        await deleteInterestMatch({ accountId, matchId });
        setMatches((prev) => prev.filter((m) => m.id !== matchId));
        toast.success('Interest removed');
        void loadSuggestions();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not remove',
        );
      }
    });
  };

  const onAddSuggestion = (suggestion: MatchSuggestion) => {
    startTransition(async () => {
      try {
        await createInterestMatch({
          accountId,
          listingId: suggestion.listingId,
          requirementId: suggestion.requirementId,
          notes: suggestion.reasons.slice(0, 2).join(' · ') || null,
          status: 'new',
        });
        toast.success('Interest added');
        setSuggestions((prev) =>
          prev.filter((s) => suggestionKey(s) !== suggestionKey(suggestion)),
        );
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add interest',
        );
      }
    });
  };

  const onExplainSuggestions = (triage: boolean) => {
    startTransition(async () => {
      try {
        const next = await explainInterestSuggestions({
          accountId,
          listingId: mode.kind === 'listing' ? mode.listingId : undefined,
          requirementId:
            mode.kind === 'requirement' ? mode.requirementId : undefined,
          mode: triage ? 'triage' : 'explain',
          limit: Math.min(12, Math.max(suggestions.length, 1)),
        });
        setSuggestions((prev) => {
          // Keep any remaining suggestions beyond the explained batch.
          const explainedKeys = new Set(next.map(suggestionKey));
          const rest = prev.filter((s) => !explainedKeys.has(suggestionKey(s)));
          return [...next, ...rest];
        });
        toast.success(triage ? 'AI ranking ready' : 'Fit explanations ready');
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'AI explain failed',
        );
      }
    });
  };

  const onDraftOutreach = (suggestion: MatchSuggestion) => {
    startTransition(async () => {
      try {
        const draft = await draftInterestOutreach({
          accountId,
          listingId: suggestion.listingId,
          requirementId: suggestion.requirementId,
          score: suggestion.score,
          reasons: suggestion.reasons,
          listingName: suggestion.listingName,
          listingSector: suggestion.listingSector,
          listingTown: suggestion.listingTown,
          listingDisposalType: suggestion.listingDisposalType,
          listingSizeMinSqft: suggestion.listingSizeMinSqft,
          listingSizeMaxSqft: suggestion.listingSizeMaxSqft,
          requirementLabel: suggestion.requirementLabel,
          requirementSector: suggestion.requirementSector,
          requirementLocationText: suggestion.requirementLocationText,
          requirementTenure: suggestion.requirementTenure,
          requirementSizeMinSqft: suggestion.requirementSizeMinSqft,
          requirementSizeMaxSqft: suggestion.requirementSizeMaxSqft,
          aiWhyFit: suggestion.aiWhyFit ?? null,
        });
        setOutreach(draft);
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not draft outreach',
        );
      }
    });
  };

  const onRankStock = (withAi = false) => {
    if (mode.kind !== 'requirement') return;
    setRankLoading(true);
    startTransition(async () => {
      try {
        const ranked = await rankBookForRequirement({
          accountId,
          requirementId: mode.requirementId,
          withAi,
        });
        setRankedBook(ranked);
        setSelectedListingIds(
          new Set(ranked.slice(0, 5).map((s) => s.listingId)),
        );
        toast.success(
          ranked.length
            ? `Ranked ${ranked.length} disposal${ranked.length === 1 ? '' : 's'}`
            : 'No strong stock matches',
        );
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not rank stock',
        );
      } finally {
        setRankLoading(false);
      }
    });
  };

  const toggleRankedListing = (listingId: string, checked: boolean) => {
    setSelectedListingIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(listingId);
      else next.delete(listingId);
      return next;
    });
  };

  const onBulkAddSelected = () => {
    if (mode.kind !== 'requirement') return;
    const listingIds = [...selectedListingIds];
    if (listingIds.length === 0) {
      toast.error('Select at least one disposal');
      return;
    }
    startTransition(async () => {
      try {
        const result = await bulkCreateInterestMatches({
          accountId,
          requirementId: mode.requirementId,
          listingIds,
        });
        toast.success(
          `Added ${result.createdCount} interest${
            result.createdCount === 1 ? '' : 's'
          }${
            result.existingCount
              ? ` (${result.existingCount} already linked)`
              : ''
          }`,
        );
        setRankedBook(null);
        setSelectedListingIds(new Set());
        await load();
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Could not add interests',
        );
      }
    });
  };

  const rankedBookBlock =
    mode.kind === 'requirement' && rankedBook ? (
      <div className="mb-5 space-y-2 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/15 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Ranked stock
            </p>
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              Select disposals to add to this requirement’s Interest schedule.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setRankedBook(null);
                setSelectedListingIds(new Set());
              }}
            >
              Clear
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending || selectedListingIds.size === 0}
              className={workspaceBtnPrimaryMd}
              onClick={onBulkAddSelected}
            >
              Add selected to Interest
            </Button>
          </div>
        </div>
        {rankedBook.length === 0 ? (
          <p className="text-xs text-[var(--workspace-shell-text)]/45">
            No ranked stock above the score threshold.
          </p>
        ) : (
          <>
            <RequirementMatchesMap
              pins={rankedBook
                .filter(
                  (s) =>
                    s.listingLatitude != null && s.listingLongitude != null,
                )
                .map((s) => ({
                  id: s.listingId,
                  name: s.listingName,
                  latitude: s.listingLatitude!,
                  longitude: s.listingLongitude!,
                  selected: selectedListingIds.has(s.listingId),
                }))}
            />
            <ul className="max-h-72 space-y-1.5 overflow-y-auto">
              {rankedBook.map((suggestion) => {
                const checked = selectedListingIds.has(suggestion.listingId);
                return (
                  <li
                    key={suggestionKey(suggestion)}
                    className="flex items-start gap-2 rounded-lg px-2 py-1.5 hover:bg-[var(--workspace-shell-sidebar-accent)]/40"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(value) =>
                        toggleRankedListing(
                          suggestion.listingId,
                          value === true,
                        )
                      }
                      className="mt-1"
                      aria-label={`Select ${suggestion.listingName}`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                          {suggestion.listingName}
                        </span>
                        <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)] tabular-nums">
                          {suggestion.score}%
                        </span>
                        {suggestion.aiRecommendation ? (
                          <span className="text-[11px] text-[var(--workspace-shell-text)]/50">
                            AI: {suggestion.aiRecommendation}
                          </span>
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                        {[
                          suggestion.listingDisposalType,
                          suggestion.listingSector,
                          suggestion.listingTown,
                          formatSize(
                            suggestion.listingSizeMinSqft,
                            suggestion.listingSizeMaxSqft,
                          ),
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                      {suggestion.reasons.length > 0 ? (
                        <p className="mt-0.5 text-[11px] text-[var(--workspace-shell-text)]/45">
                          {suggestion.reasons.slice(0, 2).join(' · ')}
                        </p>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </div>
    ) : null;

  const suggestionsBlock = (
    <div className={preview ? 'space-y-2' : 'mb-5 space-y-2'}>
      {preview ? null : (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Suggested fits
            </p>
            <p className="text-xs text-[var(--workspace-shell-text)]/45">
              Automatic matches from property type, size, location, tenure and budget —
              then optionally explain with AI.
              {suggestions.length > 0 ? (
                <>
                  {' '}
                  Showing {visibleSuggestions.length}
                  {suggestions.length > visibleSuggestions.length
                    ? ` of ${suggestions.length}`
                    : ''}{' '}
                  suggested fit{suggestions.length === 1 ? '' : 's'}.
                </>
              ) : null}
            </p>
          </div>
          {!compact && suggestions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={pending || suggestionsLoading}
                onClick={() => onExplainSuggestions(false)}
              >
                <Sparkles className="h-3.5 w-3.5" />
                Explain fits
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    className="h-8 w-8"
                    disabled={pending || suggestionsLoading}
                    aria-label="More AI actions"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={pending || suggestionsLoading}
                    onClick={() => onExplainSuggestions(true)}
                  >
                    Rank with AI
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          ) : null}
        </div>
      )}
      {!compact && suggestions.length > 0 ? (
        <p className="text-[11px] text-[var(--workspace-shell-text)]/40">
          Explain fits adds a short reason to each suggestion (uses AI credits).
        </p>
      ) : null}

      {suggestionsLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding fits…
        </div>
      ) : visibleSuggestions.length === 0 && !showUnifiedEmpty ? (
        <p className="text-xs text-[var(--workspace-shell-text)]/45">
          No strong suggestions yet — add more brief detail or stock to improve
          matches.
        </p>
      ) : visibleSuggestions.length > 0 ? (
        <ul className="space-y-2">
          {visibleSuggestions.map((suggestion) => {
            const primary =
              mode.kind === 'listing'
                ? suggestion.requirementLabel
                : suggestion.listingName;
            const secondary =
              mode.kind === 'listing'
                ? [
                    suggestion.requirementSector,
                    suggestion.requirementLocationText,
                    formatSize(
                      suggestion.requirementSizeMinSqft,
                      suggestion.requirementSizeMaxSqft,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : [
                    suggestion.listingDisposalType,
                    suggestion.listingSector,
                    suggestion.listingTown,
                    formatSize(
                      suggestion.listingSizeMinSqft,
                      suggestion.listingSizeMaxSqft,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ');

            return (
              <li
                key={suggestionKey(suggestion)}
                className="rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                        {primary}
                      </span>
                      <span className="rounded-full bg-[var(--ozer-accent-subtle)] px-2 py-0.5 text-[11px] font-medium text-[var(--workspace-shell-accent-text)] tabular-nums">
                        {suggestion.score}% fit
                      </span>
                      {suggestion.aiRecommendation ? (
                        <span className="text-[11px] text-[var(--workspace-shell-text)]/50">
                          AI: {suggestion.aiRecommendation}
                        </span>
                      ) : null}
                    </div>
                    {secondary ? (
                      <div className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text)]/50">
                        {secondary}
                      </div>
                    ) : null}
                    {suggestion.aiWhyFit ? (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/70">
                        {suggestion.aiWhyFit}
                      </p>
                    ) : suggestion.reasons.length > 0 ? (
                      <p className="mt-1 text-xs text-[var(--workspace-shell-text)]/55">
                        {suggestion.reasons.join(' · ')}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    {!compact ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        disabled={pending}
                        onClick={() => onDraftOutreach(suggestion)}
                      >
                        Draft email
                      </Button>
                    ) : null}
                    <Button
                      type="button"
                      size="sm"
                      disabled={pending}
                      className={workspaceBtnPrimaryMd}
                      onClick={() => onAddSuggestion(suggestion)}
                    >
                      Add interest
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}
      {compact &&
      seeAllHref &&
      suggestions.length > visibleSuggestions.length ? (
        <div className="pt-1">
          <Button asChild type="button" size="sm" variant="outline">
            <Link href={seeAllHref}>
              See all {suggestions.length} matches
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : compact && !preview && seeAllHref && suggestions.length > 0 ? (
        <div className="pt-1">
          <Button asChild type="button" size="sm" variant="ghost">
            <Link href={seeAllHref}>
              Open Interest
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );

  const scheduleList = (
    <>
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading interests…
        </div>
      ) : filteredMatches.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          {matches.length === 0
            ? `Add from suggestions above or link a ${
                mode.kind === 'listing' ? 'requirement' : 'disposal'
              } to start tracking.`
            : 'No interests in this stage.'}
        </p>
      ) : (
        <ul className="space-y-2">
          {filteredMatches.map((match) => {
            const primary =
              mode.kind === 'listing'
                ? match.requirementCompanyName ||
                  match.requirementContactName ||
                  'Requirement'
                : match.listingName || 'Disposal';
            const secondary =
              mode.kind === 'listing'
                ? [
                    match.requirementSector,
                    match.requirementLocationText,
                    formatSize(
                      match.requirementSizeMinSqft,
                      match.requirementSizeMaxSqft,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ')
                : [
                    match.listingDisposalType,
                    match.listingSector,
                    formatSize(
                      match.listingSizeMinSqft,
                      match.listingSizeMaxSqft,
                    ),
                  ]
                    .filter(Boolean)
                    .join(' · ');

            return (
              <li
                key={match.id}
                className="rounded-xl border border-[color:var(--workspace-shell-border)] px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
                      {primary}
                    </div>
                    {secondary ? (
                      <div className="truncate text-xs text-[var(--workspace-shell-text)]/50">
                        {secondary}
                      </div>
                    ) : null}
                    {match.notes ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[var(--workspace-shell-text)]/60">
                        {match.notes}
                      </p>
                    ) : null}
                    <p className="mt-1 text-[11px] text-[var(--workspace-shell-text)]/40">
                      {relativeActivity(match.lastActivityAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select
                      value={match.status}
                      disabled={pending}
                      onValueChange={(v) =>
                        onStatusChange(match.id, v as InterestStatus)
                      }
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {INTEREST_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {INTEREST_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      disabled={pending}
                      onClick={() => onDelete(match.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );

  const panel = (
    <>
      {rankedBookBlock}
      {showUnifiedEmpty ? (
        <div
          className={
            preview
              ? 'flex flex-col items-center justify-center gap-3 px-2 py-6 text-center'
              : 'flex flex-col items-center justify-center gap-4 px-4 py-12 text-center'
          }
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/40">
            <Search className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              Interest schedule is empty
            </p>
            <p className="max-w-sm text-sm text-[var(--workspace-shell-text)]/50">
              Find matching requirements or add interest to start tracking.
            </p>
          </div>
          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={suggestionsLoading || pending}
              onClick={() => void loadSuggestions()}
            >
              {suggestionsLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              Find matches
            </Button>
            {mode.kind === 'requirement' && !preview ? (
              <Button
                type="button"
                variant="outline"
                disabled={rankLoading || pending}
                onClick={() => onRankStock(false)}
              >
                {rankLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Rank stock
              </Button>
            ) : null}
            {preview && seeAllHref ? (
              <Button asChild type="button" className={workspaceBtnPrimaryMd}>
                <Link href={seeAllHref}>Open Interest</Link>
              </Button>
            ) : preview ? null : (
              <Button
                type="button"
                className={workspaceBtnPrimaryMd}
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Add interest
              </Button>
            )}
          </div>
        </div>
      ) : (
        <>
          {suggestionsBlock}

          {!preview ? (
            <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
              <div>
                <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
                  Interest schedule
                </p>
                <p className="text-xs text-[var(--workspace-shell-text)]/45">
                  {mode.kind === 'listing'
                    ? 'Linked requirements and their progress on this disposal.'
                    : 'Linked disposals and their progress on this requirement.'}
                </p>
              </div>

              {mode.kind === 'listing' && !compact ? (
                <div className="grid gap-3 sm:grid-cols-4">
                  <div className="space-y-1">
                    <Label className="text-xs">Property type</Label>
                    <Select
                      value={sector || 'all'}
                      onValueChange={(v) => setSector(v === 'all' ? '' : v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="All types" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All types</SelectItem>
                        {COMMERCIAL_PROPERTY_TYPES.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                        {sector &&
                        !(COMMERCIAL_PROPERTY_TYPES as readonly string[]).includes(
                          sector,
                        ) ? (
                          <SelectItem value={sector}>{sector}</SelectItem>
                        ) : null}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Size min</Label>
                    <Input
                      type="number"
                      value={sizeMin}
                      onChange={(e) => setSizeMin(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Size max</Label>
                    <Input
                      type="number"
                      value={sizeMax}
                      onChange={(e) => setSizeMax(e.target.value)}
                      className="h-8"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Activity</Label>
                    <Select value={lastDays} onValueChange={setLastDays}>
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Any time</SelectItem>
                        <SelectItem value="7">Last 7 days</SelectItem>
                        <SelectItem value="30">Last 30 days</SelectItem>
                        <SelectItem value="90">Last 90 days</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ) : null}

              {mode.kind === 'requirement' && !compact ? (
                <div className="max-w-xs space-y-1">
                  <Label className="text-xs">Activity</Label>
                  <Select value={lastDays} onValueChange={setLastDays}>
                    <SelectTrigger className="h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Any time</SelectItem>
                      <SelectItem value="7">Last 7 days</SelectItem>
                      <SelectItem value="30">Last 30 days</SelectItem>
                      <SelectItem value="90">Last 90 days</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              ) : null}

              {filteredHint ? (
                <p className="text-xs text-[var(--workspace-shell-text)]/45">
                  {filteredHint}
                </p>
              ) : null}

              {!compact ? (
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setStatusFilter('all')}
                    className={cn(
                      'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                      statusFilter === 'all'
                        ? 'bg-[var(--ozer-accent)] text-white'
                        : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:text-[var(--workspace-shell-text)]',
                    )}
                  >
                    All
                    <span className="tabular-nums opacity-80">
                      {matches.length}
                    </span>
                  </button>
                  {INTEREST_STATUSES.map((status) => {
                    const count = statusCounts[status] ?? 0;
                    if (count === 0 && statusFilter !== status) return null;
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => setStatusFilter(status)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                          statusFilter === status
                            ? 'bg-[var(--ozer-accent)] text-white'
                            : 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]/70 hover:text-[var(--workspace-shell-text)]',
                        )}
                      >
                        {INTEREST_STATUS_LABELS[status]}
                        <span className="tabular-nums opacity-80">{count}</span>
                      </button>
                    );
                  })}
                </div>
              ) : null}

              {scheduleList}
            </div>
          ) : null}
        </>
      )}

      {addOpen && !preview ? (
        <div className="mt-4 space-y-3 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/20 p-3">
          <div className="space-y-1">
            <Label className="text-xs">
              {mode.kind === 'listing' ? 'Requirement' : 'Disposal'}
            </Label>
            <Select value={pickId} onValueChange={setPickId}>
              <SelectTrigger className="h-9">
                <SelectValue
                  placeholder={
                    mode.kind === 'listing'
                      ? 'Select requirement…'
                      : 'Select disposal…'
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {options.map((opt) => (
                  <SelectItem key={opt.id} value={opt.id}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">Notes</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setAddOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              className={workspaceBtnPrimaryMd}
              onClick={onAdd}
            >
              Add interest
            </Button>
          </div>
        </div>
      ) : null}

      <Dialog open={Boolean(outreach)} onOpenChange={() => setOutreach(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Draft outreach</DialogTitle>
          </DialogHeader>
          {outreach ? (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <p className="mt-1 text-sm text-[var(--workspace-shell-text)]">
                  {outreach.subject}
                </p>
              </div>
              <div>
                <Label className="text-xs">Body</Label>
                <pre className="mt-1 rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]/20 p-3 text-sm whitespace-pre-wrap text-[var(--workspace-shell-text)]">
                  {outreach.body}
                </pre>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(
                      `${outreach.subject}\n\n${outreach.body}`,
                    );
                    toast.success('Copied');
                  } catch {
                    toast.error('Could not copy');
                  }
                }}
              >
                Copy
              </Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  );

  if (compact) {
    return (
      <div
        className={
          preview
            ? 'space-y-3'
            : 'space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4'
        }
      >
        {preview ? null : (
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
              {title}
            </h3>
            <div className="flex items-center gap-1.5">
              {mode.kind === 'requirement' ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={rankLoading || pending}
                  onClick={() => onRankStock(false)}
                >
                  {rankLoading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Sparkles className="h-3.5 w-3.5" />
                  )}
                  Rank stock
                </Button>
              ) : null}
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setAddOpen(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                Add
              </Button>
            </div>
          </div>
        )}
        {panel}
      </div>
    );
  }

  return (
    <Card className={workspacePanelCard}>
      <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0">
        <div>
          <CardTitle className="text-base text-[var(--workspace-shell-text)]">
            {title}
          </CardTitle>
          <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
            Find matches, add interest, and track status through to agreed.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {mode.kind === 'requirement' ? (
            <Button
              type="button"
              variant="outline"
              disabled={rankLoading || pending}
              onClick={() => onRankStock(false)}
            >
              {rankLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Sparkles className="h-4 w-4" />
              )}
              Rank stock
            </Button>
          ) : null}
          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            onClick={() => setAddOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Add interest
          </Button>
        </div>
      </CardHeader>
      <CardContent>{panel}</CardContent>
    </Card>
  );
}
