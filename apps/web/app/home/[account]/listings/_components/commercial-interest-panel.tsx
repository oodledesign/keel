'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import { Loader2, Plus, Sparkles } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@kit/ui/card';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@kit/ui/dialog';
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

import type { MatchSuggestion } from '~/home/[account]/listings/_lib/server/match-suggestions.service';
import {
  createInterestMatch,
  deleteInterestMatch,
  draftInterestOutreach,
  explainInterestSuggestions,
  listMatchesForListing,
  listMatchesForRequirement,
  suggestInterestMatches,
  updateInterestMatch,
} from '~/home/[account]/listings/_lib/server/matches-actions';
import type { CommercialInterestMatch } from '~/home/[account]/listings/_lib/server/matches.service';
import { listListings } from '~/home/[account]/listings/_lib/server/server-actions';
import { listRequirements } from '~/home/[account]/requirements/_lib/server/server-actions';
import {
  INTEREST_STATUSES,
  INTEREST_STATUS_LABELS,
  type InterestStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

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

  const [sector, setSector] = useState('');
  const [sizeMin, setSizeMin] = useState('');
  const [sizeMax, setSizeMax] = useState('');
  const [lastDays, setLastDays] = useState<string>('all');

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
        limit: compact ? 5 : 8,
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
          const collected: Awaited<
            ReturnType<typeof listListings>
          >['data'] = [];
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
    if (sector.trim()) bits.push(`sector “${sector.trim()}”`);
    if (sizeMin || sizeMax) bits.push('size band');
    if (lastDays !== 'all') bits.push(`last ${lastDays} days`);
    return bits.length ? `Filtered by ${bits.join(', ')}` : null;
  }, [mode.kind, sector, sizeMin, sizeMax, lastDays]);

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
          limit: 8,
        });
        setSuggestions(next);
        toast.success(triage ? 'AI triage ready' : 'AI explanations ready');
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

  const suggestionsBlock = (
    <div className="mb-5 space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            Suggested fits
          </p>
          <p className="text-xs text-[var(--workspace-shell-text)]/45">
            Rule-scored from sector, size, location, tenure and budget
          </p>
        </div>
        {!compact ? (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || suggestionsLoading}
              onClick={() => onExplainSuggestions(false)}
            >
              <Sparkles className="h-3.5 w-3.5" />
              Why these fit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={pending || suggestionsLoading}
              onClick={() => onExplainSuggestions(true)}
            >
              AI triage
            </Button>
          </div>
        ) : null}
      </div>

      {suggestionsLoading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Finding fits…
        </div>
      ) : suggestions.length === 0 ? (
        <p className="text-xs text-[var(--workspace-shell-text)]/45">
          No strong suggestions yet — add more brief detail or stock to improve
          matches.
        </p>
      ) : (
        <ul className="space-y-2">
          {suggestions.map((suggestion) => {
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
      )}
    </div>
  );

  const panel = (
    <>
      {mode.kind === 'listing' && !compact ? (
        <div className="mb-4 grid gap-3 sm:grid-cols-4">
          <div className="space-y-1">
            <Label className="text-xs">Sector</Label>
            <Input
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              placeholder="e.g. industrial"
              className="h-8"
            />
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
        <div className="mb-4 max-w-xs space-y-1">
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
        <p className="mb-2 text-xs text-[var(--workspace-shell-text)]/45">
          {filteredHint}
        </p>
      ) : null}

      {suggestionsBlock}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-[var(--workspace-shell-text)]/50">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading interests…
        </div>
      ) : matches.length === 0 ? (
        <p className="text-sm text-[var(--workspace-shell-text)]/50">
          No interests yet. Link a{' '}
          {mode.kind === 'listing' ? 'requirement' : 'disposal'} to track
          progress, or add from suggestions above.
        </p>
      ) : (
        <ul className="space-y-2">
          {matches.map((match) => {
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

      {addOpen ? (
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
      <div className="space-y-3 border-t border-[color:var(--workspace-shell-border)] pt-4">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {title}
          </h3>
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
            Interest Schedule — suggestions, one-click add, and status through
            to agreed.
          </p>
        </div>
        <Button
          type="button"
          className={workspaceBtnPrimaryMd}
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" />
          Add interest
        </Button>
      </CardHeader>
      <CardContent>{panel}</CardContent>
    </Card>
  );
}
