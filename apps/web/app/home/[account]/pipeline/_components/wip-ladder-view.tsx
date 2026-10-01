'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  DndContext,
  type DragEndEvent,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  ExternalLink,
  GripVertical,
  Search,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import {
  moveDealToStage,
  reorderPipelineDeals,
  updateDeal,
} from '~/home/(user)/pipeline/actions';
import { COMMERCIAL_PIPELINE_LOST_STAGE } from '~/lib/commercial/commercial-constants';
import { formatInstructionAddress } from '~/lib/commercial/instruction-to-disposal';
import {
  isCommercialWonStage,
  normalizeCommercialPipelineStage,
} from '~/lib/commercial/pipeline-stage-config';
import {
  type WipLatestUpdate,
  cleanWipUpdateText,
} from '~/lib/commercial/wip-latest-update';
import {
  compareInstructionOrder,
  matchesWipQuery,
  nextEndPosition,
} from '~/lib/commercial/wip-order';
import {
  wipStageColour,
  wipStageControlStyle,
} from '~/lib/commercial/wip-stage-colours';
import {
  computeWipStageForecasts,
  formatWipStageForecast,
  wipStageForecast,
} from '~/lib/commercial/wip-stage-forecasts';
import { wipWorkTypeSurface } from '~/lib/commercial/wip-work-type';
import { workspacePanelCard, workspaceTextMuted } from '~/lib/workspace-ui';

import { instructionTitle } from '../_lib/instruction-title';
import type { WipDeskActivityItem } from '../_lib/server/wip-attachments.actions';
import { WipAmlToggle } from './wip-aml-toggle';
import { WipAttachmentsStrip } from './wip-attachments-strip';
import { WipStageDot } from './wip-stage-dot';
import { WipWorkTypePill } from './wip-work-type-pill';

type StageColumn = { key: string; label: string };

type Props = {
  accountId: string;
  accountSlug: string;
  deals: PipelineDeal[];
  stages: StageColumn[];
  selectableStages?: StageColumn[];
  deskActivity: WipDeskActivityItem[];
  latestCareByDealId?: Record<string, string>;
  /** Newest update date per instruction (covers every instruction). */
  latestUpdateByDealId?: Record<string, WipLatestUpdate>;
  listings?: PipelineListingOption[];
  onDealsChange: (
    next: PipelineDeal[] | ((prev: PipelineDeal[]) => PipelineDeal[]),
  ) => void;
  onEditInstruction: (deal: PipelineDeal) => void;
  onDealWon?: (deal: PipelineDeal) => void;
  onActivityChanged?: () => void;
  expandedIds: Set<string>;
  onExpandedIdsChange: (next: Set<string>) => void;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatTimelineDate(iso: string) {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const sameYear = date.getFullYear() === new Date().getFullYear();
    return date.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      ...(sameYear ? {} : { year: 'numeric' }),
    });
  } catch {
    return '';
  }
}

/**
 * Newest update for a row: the database value covers every instruction, the
 * desk feed can be fresher right after an update is logged, so take the later.
 */
function pickLatestUpdate(
  fromDb: WipLatestUpdate | undefined,
  fromDesk: WipDeskActivityItem | undefined,
): WipLatestUpdate | null {
  const desk = fromDesk
    ? {
        at: fromDesk.createdAt,
        text: cleanWipUpdateText(fromDesk.content),
      }
    : null;
  if (!fromDb) return desk;
  if (desk && desk.at > fromDb.at) return desk;
  return fromDb;
}

function isWonStage(stage: string) {
  return isCommercialWonStage(stage) || stage === 'won' || stage === 'signed';
}

export function WipLadderView({
  accountId,
  accountSlug,
  deals,
  stages,
  selectableStages,
  deskActivity,
  latestCareByDealId = {},
  latestUpdateByDealId = {},
  listings = [],
  onDealsChange,
  onEditInstruction,
  onDealWon,
  onActivityChanged,
  expandedIds,
  onExpandedIdsChange,
}: Props) {
  const [, startTransition] = useTransition();

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) map.set(listing.id, listing);
    return map;
  }, [listings]);

  const latestByDeal = useMemo(() => {
    const map = new Map<string, WipDeskActivityItem>();
    for (const item of deskActivity) {
      if (!item.pipelineDealId || map.has(item.pipelineDealId)) continue;
      map.set(item.pipelineDealId, item);
    }
    return map;
  }, [deskActivity]);

  const [query, setQuery] = useState('');
  const searching = query.trim().length > 0;

  const stageLabelByKey = useMemo(
    () => new Map(stages.map((stage) => [stage.key, stage.label])),
    [stages],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const stage of stages) {
      map.set(stage.key, []);
    }
    for (const deal of deals) {
      const key = normalizeCommercialPipelineStage(deal.stage);
      if (
        searching &&
        !matchesWipQuery(query, [
          deal.projectName,
          deal.companyName,
          deal.contactName,
          deal.commercialListingId
            ? listingById.get(deal.commercialListingId)?.name
            : null,
          deal.nextAction,
          deal.description,
          stageLabelByKey.get(key),
        ])
      ) {
        continue;
      }
      const list = map.get(key);
      if (list) list.push(deal);
      else map.set(key, [deal]);
    }
    for (const [key, list] of map) {
      // Same order the board and sheet use; fallen-through rows sort last.
      list.sort(compareInstructionOrder);
      map.set(key, list);
    }
    return map;
  }, [deals, stages, searching, query, listingById, stageLabelByKey]);

  const matchCount = useMemo(() => {
    let count = 0;
    for (const list of dealsByStage.values()) count += list.length;
    return count;
  }, [dealsByStage]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const persistLadderOrder = useCallback(
    (_stageKey: string, orderedIds: string[]) => {
      const previous = new Map(
        deals.map(
          (deal) =>
            [
              deal.id,
              {
                ladderPosition: deal.ladderPosition,
                boardPosition: deal.boardPosition,
              },
            ] as const,
        ),
      );
      const positionById = new Map(
        orderedIds.map((id, index) => [id, index + 1]),
      );

      onDealsChange((prev) =>
        prev.map((deal) => {
          const nextPos = positionById.get(deal.id);
          return typeof nextPos === 'number'
            ? { ...deal, ladderPosition: nextPos, boardPosition: nextPos }
            : deal;
        }),
      );

      startTransition(async () => {
        try {
          const result = await reorderPipelineDeals(
            orderedIds.map((id, index) => ({
              id,
              ladderPosition: index + 1,
              boardPosition: index + 1,
            })),
            { accountSlug },
          );
          if (!result.success) {
            onDealsChange((prev) =>
              prev.map((deal) => {
                const prior = previous.get(deal.id);
                return prior
                  ? {
                      ...deal,
                      ladderPosition: prior.ladderPosition,
                      boardPosition: prior.boardPosition,
                    }
                  : deal;
              }),
            );
            toast.error(result.error ?? 'Could not reorder ladder');
          }
        } catch (error) {
          onDealsChange((prev) =>
            prev.map((deal) => {
              const prior = previous.get(deal.id);
              return prior
                ? {
                    ...deal,
                    ladderPosition: prior.ladderPosition,
                    boardPosition: prior.boardPosition,
                  }
                : deal;
            }),
          );
          toast.error(
            error instanceof Error ? error.message : 'Could not reorder ladder',
          );
        }
      });
    },
    [accountSlug, deals, onDealsChange],
  );

  const onLadderDragEnd = useCallback(
    (stageKey: string, event: DragEndEvent) => {
      const { active, over } = event;
      if (!over || active.id === over.id) return;
      const stageDeals = dealsByStage.get(stageKey) ?? [];
      // Do not reorder within fallen-through via drag — they stay pinned last.
      if (stageKey === COMMERCIAL_PIPELINE_LOST_STAGE) return;

      const ids = stageDeals.map((deal) => deal.id);
      const fromIndex = ids.indexOf(String(active.id));
      const toIndex = ids.indexOf(String(over.id));
      if (fromIndex < 0 || toIndex < 0) return;
      persistLadderOrder(stageKey, arrayMove(ids, fromIndex, toIndex));
    },
    [dealsByStage, persistLadderOrder],
  );

  const toggleExpanded = useCallback(
    (dealId: string) => {
      const next = new Set(expandedIds);
      if (next.has(dealId)) next.delete(dealId);
      else next.add(dealId);
      onExpandedIdsChange(next);
    },
    [expandedIds, onExpandedIdsChange],
  );

  const stageChoices = selectableStages ?? stages;

  const changeStage = (deal: PipelineDeal, nextStage: string) => {
    if (nextStage === deal.stage) return;
    const previousStage = deal.stage;
    const position = nextEndPosition(
      deals
        .filter(
          (item) =>
            item.id !== deal.id &&
            normalizeCommercialPipelineStage(item.stage) === nextStage,
        )
        .map((item) => item.ladderPosition),
    );
    const updated = {
      ...deal,
      stage: nextStage,
      ladderPosition: position,
      boardPosition: position,
    };
    onDealsChange((prev) =>
      prev.map((item) => (item.id === deal.id ? updated : item)),
    );

    startTransition(async () => {
      try {
        const result = await moveDealToStage(deal.id, nextStage, {
          accountSlug,
          boardPosition: position,
          ladderPosition: position,
        });
        if (!result.success) {
          onDealsChange((prev) =>
            prev.map((item) =>
              item.id === deal.id
                ? {
                    ...item,
                    stage: previousStage,
                    ladderPosition: deal.ladderPosition,
                    boardPosition: deal.boardPosition,
                  }
                : item,
            ),
          );
          toast.error(result.error ?? 'Could not update stage');
          return;
        }
        if (isWonStage(nextStage)) {
          onDealWon?.(updated);
        }
      } catch (error) {
        onDealsChange((prev) =>
          prev.map((item) =>
            item.id === deal.id
              ? {
                  ...item,
                  stage: previousStage,
                  ladderPosition: deal.ladderPosition,
                  boardPosition: deal.boardPosition,
                }
              : item,
          ),
        );
        toast.error(
          error instanceof Error ? error.message : 'Could not update stage',
        );
      }
    });
  };

  const stageForecasts = useMemo(
    () => computeWipStageForecasts(deals),
    [deals],
  );

  // Config order is the ladder: Billed at the top, Fallen through last.
  const ladderStages = useMemo(() => {
    const fallen = stages.filter(
      (stage) => stage.key === COMMERCIAL_PIPELINE_LOST_STAGE,
    );
    const rest = stages.filter(
      (stage) => stage.key !== COMMERCIAL_PIPELINE_LOST_STAGE,
    );
    return [...rest, ...fallen];
  }, [stages]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-3 px-4 pb-3 md:px-6 lg:px-8">
        <label className="relative w-full max-w-xs">
          <span className="sr-only">Search instructions</span>
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--workspace-shell-text)]/40"
          />
          <input
            type="search"
            value={query}
            placeholder="Search instructions…"
            data-test="wip-ladder-search"
            onChange={(event) => setQuery(event.target.value)}
            className="h-8 w-full rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] pr-2 pl-8 text-sm text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text)]/35 focus:border-[var(--ozer-accent)]/50"
          />
        </label>
        {searching ? (
          <span
            className={`text-xs tabular-nums ${workspaceTextMuted}`}
            data-test="wip-ladder-search-count"
          >
            {matchCount} of {deals.length}
            {' · '}
            Clear the search to reorder
          </span>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 pb-6 md:px-6 lg:px-8">
        {searching && matchCount === 0 ? (
          <p
            className={`px-1 py-6 text-sm ${workspaceTextMuted}`}
            data-test="wip-ladder-search-empty"
          >
            No instructions match your search.
          </p>
        ) : null}
        {ladderStages.map((stage) => {
          const stageDeals = dealsByStage.get(stage.key) ?? [];
          // While searching, only stages with a match are shown.
          if (searching && stageDeals.length === 0) return null;
          const colour = wipStageColour(stage.key);
          const forecast = searching
            ? {
                count: stageDeals.length,
                fee: stageDeals.reduce(
                  (sum, deal) =>
                    sum + (Number.isFinite(deal.value) ? deal.value : 0),
                  0,
                ),
              }
            : wipStageForecast(stageForecasts, stage.key);
          return (
            <section
              key={stage.key}
              className={workspacePanelCard}
              style={{
                borderLeftWidth: 4,
                borderLeftColor: colour.bar,
              }}
            >
              {/*
              Sticks to the top of the ladder's scroll area while its stage is
              in view; the next stage's header pushes it out. The tint is
              translucent, so it sits over the opaque panel colour, otherwise
              rows would show through as they scroll underneath.
            */}
              <header
                className="sticky top-0 z-10 flex items-center justify-between gap-3 rounded-t-2xl border-b border-[color:var(--workspace-shell-border)] px-4 py-3"
                style={{
                  backgroundColor: 'var(--workspace-shell-panel)',
                  backgroundImage: `linear-gradient(${colour.tint}, ${colour.tint})`,
                }}
                data-test="wip-ladder-stage-header"
              >
                <h3
                  className="text-sm font-semibold tracking-wide"
                  style={{ color: colour.label }}
                >
                  {stage.label}
                </h3>
                <span
                  className="text-xs font-medium tabular-nums"
                  style={{ color: colour.label }}
                  data-test="wip-stage-forecast"
                >
                  {formatWipStageForecast(forecast)}
                </span>
              </header>

              {stageDeals.length === 0 ? (
                <p className={`px-4 py-3 text-sm ${workspaceTextMuted}`}>
                  No instructions in this stage
                </p>
              ) : (
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={(event) => onLadderDragEnd(stage.key, event)}
                >
                  <SortableContext
                    items={stageDeals.map((deal) => deal.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <ul className="divide-y divide-[color:var(--workspace-shell-border)]/70">
                      <li
                        className={`hidden border-b border-[color:var(--workspace-shell-border)]/50 px-3 py-1.5 text-[10px] font-medium tracking-wide uppercase sm:grid sm:grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_5.5rem_4.5rem_9.5rem_auto] sm:gap-3 ${workspaceTextMuted}`}
                        aria-hidden
                      >
                        <span />
                        <span>Instruction</span>
                        <span>Last contact</span>
                        <span className="text-right">Value</span>
                        <span>AML</span>
                        <span>Stage</span>
                        <span />
                      </li>
                      {stageDeals.map((deal) => {
                        const open = expandedIds.has(deal.id);
                        const latest = latestByDeal.get(deal.id);
                        const lastUpdate = pickLatestUpdate(
                          latestUpdateByDealId[deal.id],
                          latest,
                        );
                        const listing = deal.commercialListingId
                          ? (listingById.get(deal.commercialListingId) ??
                            undefined)
                          : undefined;
                        const lastContactIso =
                          latestCareByDealId[deal.id] ??
                          latest?.createdAt ??
                          null;

                        return (
                          <LadderSortableRow
                            key={deal.id}
                            deal={deal}
                            canDrag={
                              !searching &&
                              stage.key !== COMMERCIAL_PIPELINE_LOST_STAGE
                            }
                            open={open}
                            lastUpdate={lastUpdate}
                            listing={listing}
                            lastContactIso={lastContactIso}
                            accountSlug={accountSlug}
                            accountId={accountId}
                            stages={stageOptionsForDeal(
                              deal,
                              stageChoices,
                              stages,
                            )}
                            onToggle={() => toggleExpanded(deal.id)}
                            onChangeStage={(next) => changeStage(deal, next)}
                            onToggleAml={(next) => {
                              const previous = {
                                amlDone: deal.amlDone,
                                amlDoneAt: deal.amlDoneAt,
                                amlDoneBy: deal.amlDoneBy,
                              };
                              onDealsChange((prev) =>
                                prev.map((item) =>
                                  item.id === deal.id
                                    ? {
                                        ...item,
                                        amlDone: next,
                                        amlDoneAt: next
                                          ? new Date().toISOString()
                                          : null,
                                        amlDoneBy: next ? item.amlDoneBy : null,
                                      }
                                    : item,
                                ),
                              );
                              startTransition(async () => {
                                try {
                                  const result = await updateDeal(deal.id, {
                                    amlDone: next,
                                    accountSlug,
                                  });
                                  if (!result.success) {
                                    onDealsChange((prev) =>
                                      prev.map((item) =>
                                        item.id === deal.id
                                          ? { ...item, ...previous }
                                          : item,
                                      ),
                                    );
                                    toast.error(
                                      result.error ?? 'Could not update AML',
                                    );
                                  }
                                } catch (error) {
                                  onDealsChange((prev) =>
                                    prev.map((item) =>
                                      item.id === deal.id
                                        ? { ...item, ...previous }
                                        : item,
                                    ),
                                  );
                                  toast.error(
                                    error instanceof Error
                                      ? error.message
                                      : 'Could not update AML',
                                  );
                                }
                              });
                            }}
                            onEdit={() => onEditInstruction(deal)}
                            onActivityChanged={onActivityChanged}
                          />
                        );
                      })}
                    </ul>
                  </SortableContext>
                </DndContext>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function stageOptionsForDeal(
  deal: PipelineDeal,
  selectable: StageColumn[],
  allStages: StageColumn[],
): StageColumn[] {
  const current = String(normalizeCommercialPipelineStage(deal.stage));
  if (selectable.some((stage) => stage.key === current)) return selectable;
  const currentLabel =
    allStages.find((stage) => stage.key === current)?.label ?? current;
  return [{ key: current, label: currentLabel }, ...selectable];
}

function LadderSortableRow({
  deal,
  canDrag,
  open,
  lastUpdate,
  listing,
  lastContactIso,
  accountSlug,
  accountId,
  stages,
  onToggle,
  onChangeStage,
  onToggleAml,
  onEdit,
  onActivityChanged,
}: {
  deal: PipelineDeal;
  canDrag: boolean;
  open: boolean;
  lastUpdate: WipLatestUpdate | null;
  listing: PipelineListingOption | undefined;
  lastContactIso: string | null;
  accountSlug: string;
  accountId: string;
  stages: StageColumn[];
  onToggle: () => void;
  onChangeStage: (next: string) => void;
  onToggleAml: (next: boolean) => void;
  onEdit: () => void;
  onActivityChanged?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id, disabled: !canDrag });
  const addressSummary = formatInstructionAddress(deal);

  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        backgroundColor: wipWorkTypeSurface(deal.workType),
      }}
    >
      <div className="grid grid-cols-1 items-center gap-2 px-3 py-2.5 sm:grid-cols-[1.25rem_minmax(0,1fr)_6.5rem_5.5rem_4.5rem_9.5rem_auto] sm:gap-3">
        <button
          type="button"
          className={`hidden touch-none items-center justify-center text-[var(--workspace-shell-text-muted)] sm:flex ${
            canDrag
              ? 'cursor-grab active:cursor-grabbing'
              : 'cursor-default opacity-30'
          }`}
          aria-label={canDrag ? 'Drag to reorder' : 'Reorder unavailable'}
          disabled={!canDrag}
          {...(canDrag ? { ...attributes, ...listeners } : {})}
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <button
          type="button"
          className="flex min-w-0 items-start gap-2 text-left"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={
            open
              ? `Collapse ${instructionTitle(deal)}`
              : `Expand ${instructionTitle(deal)}`
          }
        >
          {open ? (
            <ChevronDown className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
          ) : (
            <ChevronRight className="mt-0.5 h-4 w-4 shrink-0 text-[var(--workspace-shell-text-muted)]" />
          )}
          <span className="min-w-0">
            <span className="block text-sm font-medium text-[var(--workspace-shell-text)]">
              {instructionTitle(deal)}
              <WipWorkTypePill workType={deal.workType} className="ml-2" />
            </span>
            {deal.commercialListingId && listing?.name ? (
              <Link
                href={pathsConfig.app.accountListingDetail
                  .replace('[account]', accountSlug)
                  .replace('[id]', deal.commercialListingId)}
                onClick={(event) => event.stopPropagation()}
                className="mt-0.5 inline-flex max-w-full truncate text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
              >
                {listing.name}
              </Link>
            ) : addressSummary ? (
              <span
                className={`mt-0.5 block truncate text-xs ${workspaceTextMuted}`}
                data-test="wip-ladder-address"
              >
                {addressSummary}
              </span>
            ) : null}
            <span
              className={`mt-0.5 block truncate text-xs ${workspaceTextMuted}`}
              data-test="wip-ladder-last-update"
            >
              {lastUpdate ? (
                <>
                  <time
                    dateTime={lastUpdate.at}
                    className="font-medium text-[var(--workspace-shell-text)]"
                  >
                    {formatTimelineDate(lastUpdate.at)}
                  </time>
                  {lastUpdate.text ? ` ${lastUpdate.text}` : null}
                </>
              ) : (
                'No updates yet'
              )}
            </span>
          </span>
        </button>

        <div
          className={`pl-6 text-xs tabular-nums sm:pl-0 ${workspaceTextMuted}`}
          title="Last contact"
        >
          <span className="sm:hidden">Last contact · </span>
          {lastContactIso ? formatTimelineDate(lastContactIso) : '—'}
        </div>

        <span className="pl-6 text-sm text-[var(--workspace-shell-text)] tabular-nums sm:pl-0 sm:text-right">
          {formatCurrency(deal.value || 0)}
        </span>

        <div className="pl-6 sm:pl-0">
          <WipAmlToggle
            done={deal.amlDone}
            doneAt={deal.amlDoneAt}
            instructionName={deal.projectName || deal.companyName}
            onToggle={onToggleAml}
          />
        </div>

        <div className="pl-6 sm:pl-0">
          <Select
            value={normalizeCommercialPipelineStage(deal.stage)}
            onValueChange={onChangeStage}
          >
            <SelectTrigger
              className="h-8 w-full text-xs font-medium"
              style={wipStageControlStyle(deal.stage)}
              data-test="wip-ladder-stage-select"
              aria-label="Stage"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="z-[100] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
              {stages.map((option) => (
                <SelectItem key={option.key} value={option.key}>
                  <span className="flex items-center gap-2">
                    <WipStageDot stageKey={option.key} />
                    {option.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center gap-1 pl-6 sm:pl-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1 text-xs text-[var(--workspace-shell-text-muted)]"
            onClick={onEdit}
          >
            Open
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-[color:var(--workspace-shell-border)]/60 bg-[var(--workspace-shell-sidebar-accent)]/25 px-4 py-3">
          <WipAttachmentsStrip
            accountId={accountId}
            accountSlug={accountSlug}
            pipelineDealId={deal.id}
            activityOnly
            previewCount={3}
            onActivityChanged={onActivityChanged}
          />
          <div className="mt-3">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)]"
              onClick={onEdit}
            >
              Full instruction
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}
