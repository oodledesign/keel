'use client';

import { type KeyboardEvent, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react';

import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type { PipelineDeal } from '~/home/(user)/_lib/server/pipeline.loader';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { moveDealToStage, updateDeal } from '~/home/(user)/pipeline/actions';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { updateRequirement } from '~/home/[account]/requirements/_lib/server/server-actions';
import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from '~/lib/commercial/commercial-constants';
import { normalizeCommercialPipelineStage } from '~/lib/commercial/pipeline-stage-config';
import { normalizeRequirementUseClass } from '~/lib/commercial/requirement-use-class';
import type { WipBoardView } from '~/lib/commercial/wip-board-mapping';
import {
  compareInstructionOrder,
  compareRequirementOrder,
  matchesWipQuery,
  nextEndPosition,
} from '~/lib/commercial/wip-order';
import {
  type SheetSort,
  type SheetSortValue,
  nextSheetSort,
  sortSheetRows,
} from '~/lib/commercial/wip-sheet-sort';
import { wipStageColour } from '~/lib/commercial/wip-stage-colours';
import {
  computeWipStageForecasts,
  formatWipStageForecast,
  wipStageForecast,
} from '~/lib/commercial/wip-stage-forecasts';
import { wipWorkTypeSurface } from '~/lib/commercial/wip-work-type';
import { workspaceTextMuted } from '~/lib/workspace-ui';

import { WipAmlToggle } from './wip-aml-toggle';

type Props = {
  accountId: string;
  accountSlug: string;
  view: WipBoardView;
  deals: PipelineDeal[];
  requirements: CommercialRequirement[];
  instructionStages: Array<{ key: string; label: string }>;
  selectableStages?: Array<{ key: string; label: string }>;
  listings?: PipelineListingOption[];
  onDealsChange: (next: PipelineDeal[]) => void;
  onRequirementsChange: (next: CommercialRequirement[]) => void;
  onEditRequirement: (requirement: CommercialRequirement) => void;
  onEditInstruction: (deal: PipelineDeal) => void;
};

const cellInputClass =
  'h-8 w-full min-w-[6rem] rounded-md border border-transparent bg-transparent px-2 text-sm text-[var(--workspace-shell-text)] outline-none transition-colors placeholder:text-[var(--workspace-shell-text)]/25 hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const matchesSheetQuery = matchesWipQuery;

function SheetSectionHeader({
  title,
  count,
  totalCount,
  query,
  placeholder,
  onQueryChange,
  sortLabel,
  onClearSort,
}: {
  title: string;
  count: number;
  totalCount: number;
  query: string;
  placeholder: string;
  onQueryChange: (next: string) => void;
  /** Set while a column sort is active; null means stage order. */
  sortLabel: string | null;
  onClearSort: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-[color:var(--workspace-shell-border)] px-3 py-2">
      <h3 className="shrink-0 text-sm font-semibold text-[var(--workspace-shell-text)]">
        {title}
      </h3>
      <label className="relative w-full max-w-xs">
        <span className="sr-only">{placeholder}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-[var(--workspace-shell-text)]/40"
        />
        <input
          type="search"
          value={query}
          placeholder={placeholder}
          onChange={(e) => onQueryChange(e.target.value)}
          className="h-8 w-full rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] pr-2 pl-8 text-sm text-[var(--workspace-shell-text)] outline-none placeholder:text-[var(--workspace-shell-text)]/35 focus:border-[var(--ozer-accent)]/50"
        />
      </label>
      {sortLabel ? (
        <button
          type="button"
          onClick={onClearSort}
          data-test="wip-sheet-clear-sort"
          className="ml-auto inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-[color:var(--workspace-shell-border)] px-2.5 text-xs font-medium text-[var(--workspace-shell-text)] transition-colors hover:bg-[var(--workspace-shell-sidebar-accent)]"
          title="Back to stage order"
        >
          Sorted by {sortLabel}
          <X aria-hidden className="h-3 w-3" />
        </button>
      ) : (
        <span className={`ml-auto shrink-0 text-xs ${workspaceTextMuted}`}>
          Stage order
        </span>
      )}
      <span className={`shrink-0 text-xs tabular-nums ${workspaceTextMuted}`}>
        {query.trim() ? `${count} of ${totalCount}` : totalCount}
      </span>
    </div>
  );
}

const selectClass =
  'h-8 w-full min-w-[7rem] rounded-md border border-transparent bg-transparent px-1.5 text-sm text-[var(--workspace-shell-text)] outline-none hover:border-[color:var(--workspace-shell-border)] focus:border-[var(--ozer-accent)]/50 focus:bg-[var(--workspace-shell-sidebar-accent)]/30';

const thClass =
  'sticky top-0 z-10 whitespace-nowrap border-b border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] px-2 py-2 text-left text-[11px] font-medium tracking-wide text-[var(--workspace-shell-text)]/55';

const tdClass =
  'border-b border-[color:var(--workspace-shell-border)]/70 px-1.5 py-1 align-middle';

function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  className,
}: {
  label: string;
  sortKey: string;
  sort: SheetSort | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey ? sort.direction : null;
  const Icon =
    active === 'asc' ? ArrowUp : active === 'desc' ? ArrowDown : ArrowUpDown;
  return (
    <th
      className={`${thClass} ${className ?? ''}`}
      aria-sort={
        active === 'asc'
          ? 'ascending'
          : active === 'desc'
            ? 'descending'
            : 'none'
      }
    >
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        data-test={`wip-sheet-sort-${sortKey}`}
        className={`inline-flex items-center gap-1 text-[11px] font-medium tracking-wide transition-colors hover:text-[var(--workspace-shell-text)] ${
          active ? 'text-[var(--workspace-shell-text)]' : ''
        }`}
      >
        {label}
        <Icon aria-hidden className={`h-3 w-3 ${active ? '' : 'opacity-40'}`} />
      </button>
    </th>
  );
}

const INSTRUCTION_SORT_LABELS: Record<string, string> = {
  title: 'Title',
  company: 'Company',
  contact: 'Contact',
  disposal: 'Disposal',
  value: 'Value',
  stage: 'Stage',
  aml: 'AML',
  nextAction: 'Next action',
  due: 'Due',
  notes: 'Notes',
};

const REQUIREMENT_SORT_LABELS: Record<string, string> = {
  updated: 'Updated',
  company: 'Company',
  contact: 'Contact',
  tel: 'Tel',
  email: 'Email',
  use: 'Use',
  tenure: 'FH / LH',
  sizeMin: 'Size min',
  sizeMax: 'Size max',
  location: 'Location',
  detailsSent: 'Details sent',
  stage: 'Stage',
  notes: 'Notes',
};

function sortDescription(
  sort: SheetSort | null,
  labels: Record<string, string>,
): string | null {
  if (!sort) return null;
  const label = labels[sort.key] ?? sort.key;
  return `${label} ${sort.direction === 'asc' ? '↑' : '↓'}`;
}

function sheetStageOptions(
  deal: PipelineDeal,
  selectable: Array<{ key: string; label: string }>,
  allStages: Array<{ key: string; label: string }>,
) {
  const current = String(normalizeCommercialPipelineStage(deal.stage));
  if (selectable.some((stage) => stage.key === current)) return selectable;
  const currentLabel =
    allStages.find((stage) => stage.key === current)?.label ?? current;
  return [{ key: current, label: currentLabel }, ...selectable];
}

function formatDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString('en-GB');
  } catch {
    return '';
  }
}

function parseOptionalNumber(raw: string): number | null {
  const t = raw.trim().replace(/[£,\s]/g, '');
  if (!t) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

const gbpFormatter = new Intl.NumberFormat('en-GB', {
  style: 'currency',
  currency: 'GBP',
  maximumFractionDigits: 0,
});

function SheetTextCell({
  value,
  placeholder,
  className,
  onCommit,
}: {
  value: string;
  placeholder?: string;
  className?: string;
  onCommit: (next: string) => void;
}) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onCommit(draft);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.currentTarget.blur();
    }
    if (event.key === 'Escape') {
      setDraft(value);
      setEditing(false);
      event.currentTarget.blur();
    }
  };

  return (
    <input
      value={editing ? draft : value}
      placeholder={placeholder}
      className={`${cellInputClass} ${className ?? ''}`}
      onFocus={() => {
        setDraft(value);
        setEditing(true);
      }}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

export function WipSheetView({
  accountId,
  accountSlug,
  view,
  deals,
  requirements,
  instructionStages,
  selectableStages,
  listings = [],
  onDealsChange,
  onRequirementsChange,
  onEditRequirement,
  onEditInstruction,
}: Props) {
  const [, startTransition] = useTransition();
  const [requirementQuery, setRequirementQuery] = useState('');
  const [instructionQuery, setInstructionQuery] = useState('');
  // null = stage order (the manual order shared with the ladder and board).
  const [requirementSort, setRequirementSort] = useState<SheetSort | null>(
    null,
  );
  const [instructionSort, setInstructionSort] = useState<SheetSort | null>(
    null,
  );

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) map.set(listing.id, listing);
    return map;
  }, [listings]);

  const stageIndexByKey = useMemo(
    () => new Map(instructionStages.map((stage, index) => [stage.key, index])),
    [instructionStages],
  );

  // Stage order first, then the manual order shared with the ladder and board.
  const sortedDeals = useMemo(
    () =>
      deals
        .slice()
        .sort(
          (a, b) =>
            (stageIndexByKey.get(normalizeCommercialPipelineStage(a.stage)) ??
              999) -
              (stageIndexByKey.get(normalizeCommercialPipelineStage(b.stage)) ??
                999) || compareInstructionOrder(a, b),
        ),
    [deals, stageIndexByKey],
  );

  const stageForecasts = useMemo(
    () => computeWipStageForecasts(deals),
    [deals],
  );

  // Stage order first, then the manual order shared with the board.
  const sortedRequirements = useMemo(
    () =>
      requirements
        .slice()
        .sort(
          (a, b) =>
            REQUIREMENT_STATUSES.indexOf(a.stage) -
              REQUIREMENT_STATUSES.indexOf(b.stage) ||
            compareRequirementOrder(a, b),
        ),
    [requirements],
  );

  const visibleRequirements = useMemo(
    () =>
      sortedRequirements.filter((row) =>
        matchesSheetQuery(requirementQuery, [
          row.companyName,
          row.contactName,
          row.contactPhone,
          row.contactEmail,
          row.sector,
          row.locationText,
          row.notes,
          REQUIREMENT_STATUS_LABELS[row.stage],
        ]),
      ),
    [sortedRequirements, requirementQuery],
  );

  const visibleDeals = useMemo(
    () =>
      sortedDeals.filter((deal) => {
        const listingName = deal.commercialListingId
          ? listingById.get(deal.commercialListingId)?.name
          : null;
        const stageLabel = instructionStages.find(
          (stage) => stage.key === normalizeCommercialPipelineStage(deal.stage),
        )?.label;
        return matchesSheetQuery(instructionQuery, [
          deal.projectName,
          deal.companyName,
          deal.contactName,
          listingName,
          deal.nextAction,
          deal.description,
          stageLabel,
        ]);
      }),
    [sortedDeals, instructionQuery, listingById, instructionStages],
  );

  const requirementRank = useMemo(
    () => new Map(sortedRequirements.map((row, index) => [row.id, index])),
    [sortedRequirements],
  );
  const dealRank = useMemo(
    () => new Map(sortedDeals.map((deal, index) => [deal.id, index])),
    [sortedDeals],
  );

  // With no column sort these stay in stage order; a column sort flattens them.
  const displayRequirements = useMemo(() => {
    if (!requirementSort) return visibleRequirements;
    const getValue = (row: CommercialRequirement): SheetSortValue => {
      switch (requirementSort.key) {
        case 'updated':
          return new Date(row.updatedAt).getTime();
        case 'company':
          return row.companyName;
        case 'contact':
          return row.contactName;
        case 'tel':
          return row.contactPhone;
        case 'email':
          return row.contactEmail;
        case 'use':
          return row.sector;
        case 'tenure':
          return row.tenure;
        case 'sizeMin':
          return row.sizeMinSqft;
        case 'sizeMax':
          return row.sizeMaxSqft;
        case 'location':
          return row.locationText;
        case 'detailsSent':
          return row.detailsSent;
        case 'stage':
          return REQUIREMENT_STATUSES.indexOf(row.stage);
        case 'notes':
          return row.notes;
        default:
          return null;
      }
    };
    return sortSheetRows(
      visibleRequirements,
      requirementSort,
      getValue,
      (a, b) =>
        (requirementRank.get(a.id) ?? 0) - (requirementRank.get(b.id) ?? 0),
    );
  }, [visibleRequirements, requirementSort, requirementRank]);

  const flatDeals = useMemo(() => {
    if (!instructionSort) return null;
    const getValue = (deal: PipelineDeal): SheetSortValue => {
      switch (instructionSort.key) {
        case 'title':
          return deal.projectName;
        case 'company':
          return deal.companyName;
        case 'contact':
          return deal.contactName;
        case 'disposal':
          return deal.commercialListingId
            ? listingById.get(deal.commercialListingId)?.name
            : null;
        case 'value':
          return deal.value || null;
        case 'stage':
          return (
            stageIndexByKey.get(normalizeCommercialPipelineStage(deal.stage)) ??
            999
          );
        case 'aml':
          return deal.amlDone;
        case 'nextAction':
          return deal.nextAction;
        case 'due':
          return deal.nextActionDate;
        case 'notes':
          return deal.description;
        default:
          return null;
      }
    };
    return sortSheetRows(
      visibleDeals,
      instructionSort,
      getValue,
      (a, b) => (dealRank.get(a.id) ?? 0) - (dealRank.get(b.id) ?? 0),
    );
  }, [visibleDeals, instructionSort, listingById, stageIndexByKey, dealRank]);

  const showInstructions = view === 'instructions' || view === 'both';
  const showRequirements = view === 'requirements' || view === 'both';

  const patchRequirement = (
    id: string,
    patch: Partial<CommercialRequirement>,
    serverPatch: Record<string, unknown>,
  ) => {
    const previous = requirements;
    onRequirementsChange(
      requirements.map((r) => (r.id === id ? { ...r, ...patch } : r)),
    );
    startTransition(async () => {
      try {
        const updated = await updateRequirement({
          accountId,
          requirementId: id,
          ...serverPatch,
        });
        onRequirementsChange(previous.map((r) => (r.id === id ? updated : r)));
      } catch (error) {
        onRequirementsChange(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not save requirement',
        );
      }
    });
  };

  const patchDeal = (
    id: string,
    patch: Partial<PipelineDeal>,
    serverPatch: Parameters<typeof updateDeal>[1],
  ) => {
    const previous = deals;
    onDealsChange(deals.map((d) => (d.id === id ? { ...d, ...patch } : d)));
    startTransition(async () => {
      try {
        await updateDeal(id, { ...serverPatch, accountSlug });
      } catch (error) {
        onDealsChange(previous);
        toast.error(
          error instanceof Error ? error.message : 'Could not save instruction',
        );
      }
    });
  };

  const renderDealRow = (deal: PipelineDeal) => {
    const listing = deal.commercialListingId
      ? listingById.get(deal.commercialListingId)
      : null;
    const stageColour = wipStageColour(deal.stage);
    const workSurface = wipWorkTypeSurface(deal.workType);
    return (
      <tr
        key={deal.id}
        className="hover:bg-[var(--workspace-shell-sidebar-accent)]/25"
        style={{
          boxShadow: `inset 3px 0 0 ${stageColour.bar}`,
          ...(workSurface ? { backgroundColor: workSurface } : null),
        }}
      >
        <td className={tdClass}>
          <SheetTextCell
            value={deal.projectName ?? ''}
            placeholder="Instruction"
            className="min-w-[10rem] font-medium"
            onCommit={(next) =>
              patchDeal(
                deal.id,
                { projectName: next.trim() || null },
                { projectName: next.trim() || null },
              )
            }
          />
        </td>
        <td className={tdClass}>
          <SheetTextCell
            value={deal.companyName}
            placeholder="Company"
            className="min-w-[8rem]"
            onCommit={(next) =>
              patchDeal(deal.id, { companyName: next }, { companyName: next })
            }
          />
        </td>
        <td className={tdClass}>
          <SheetTextCell
            value={deal.contactName}
            placeholder="Contact"
            className="min-w-[8rem]"
            onCommit={(next) =>
              patchDeal(deal.id, { contactName: next }, { contactName: next })
            }
          />
        </td>
        <td className={`${tdClass} px-2`}>
          {deal.commercialListingId ? (
            <Link
              href={pathsConfig.app.accountListingDetail
                .replace('[account]', accountSlug)
                .replace('[id]', deal.commercialListingId)}
              className="block max-w-[12rem] truncate text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
              title="Open disposal"
            >
              {listing?.name?.trim() || 'Open disposal'}
            </Link>
          ) : (
            <span className={`text-xs ${workspaceTextMuted}`}>—</span>
          )}
        </td>
        <td className={tdClass}>
          <SheetTextCell
            value={deal.value ? gbpFormatter.format(deal.value) : ''}
            placeholder="£-"
            className="min-w-[6rem] tabular-nums"
            onCommit={(next) => {
              const value = parseOptionalNumber(next) ?? 0;
              patchDeal(deal.id, { value }, { value });
            }}
          />
        </td>
        <td className={tdClass}>
          <select
            className={selectClass}
            style={{
              color: stageColour.label,
              borderColor: stageColour.bar,
              background: stageColour.tint,
            }}
            value={normalizeCommercialPipelineStage(deal.stage)}
            onChange={(e) => {
              const stage = e.target.value;
              const current = String(
                normalizeCommercialPipelineStage(deal.stage),
              );
              if (stage === current) return;
              const position = nextEndPosition(
                deals
                  .filter(
                    (item) =>
                      item.id !== deal.id &&
                      normalizeCommercialPipelineStage(item.stage) === stage,
                  )
                  .map((item) => item.ladderPosition),
              );
              const previous = deals;
              onDealsChange(
                deals.map((item) =>
                  item.id === deal.id
                    ? {
                        ...item,
                        stage,
                        ladderPosition: position,
                        boardPosition: position,
                      }
                    : item,
                ),
              );
              startTransition(async () => {
                try {
                  const result = await moveDealToStage(deal.id, stage, {
                    accountSlug,
                    boardPosition: position,
                    ladderPosition: position,
                  });
                  if (!result.success) {
                    onDealsChange(previous);
                    toast.error(result.error ?? 'Could not update stage');
                  }
                } catch (error) {
                  onDealsChange(previous);
                  toast.error(
                    error instanceof Error
                      ? error.message
                      : 'Could not update stage',
                  );
                }
              });
            }}
          >
            {sheetStageOptions(
              deal,
              selectableStages ?? instructionStages,
              instructionStages,
            ).map((stageOption) => (
              <option key={stageOption.key} value={stageOption.key}>
                {stageOption.label}
              </option>
            ))}
          </select>
        </td>
        <td className={`${tdClass} px-2`}>
          <WipAmlToggle
            done={deal.amlDone}
            doneAt={deal.amlDoneAt}
            instructionName={deal.projectName || deal.companyName}
            onToggle={(next) =>
              patchDeal(
                deal.id,
                {
                  amlDone: next,
                  amlDoneAt: next ? new Date().toISOString() : null,
                  amlDoneBy: next ? deal.amlDoneBy : null,
                },
                { amlDone: next },
              )
            }
          />
        </td>
        <td className={tdClass}>
          <SheetTextCell
            value={deal.nextAction}
            placeholder="Next action"
            className="min-w-[9rem]"
            onCommit={(next) =>
              patchDeal(deal.id, { nextAction: next }, { nextAction: next })
            }
          />
        </td>
        <td className={tdClass}>
          <input
            type="date"
            className={selectClass}
            defaultValue={deal.nextActionDate?.slice(0, 10) ?? ''}
            key={`${deal.id}-due-${deal.nextActionDate ?? ''}`}
            onBlur={(e) => {
              const nextActionDate = e.target.value || null;
              const current = deal.nextActionDate?.slice(0, 10) || null;
              if (nextActionDate === current) return;
              patchDeal(deal.id, { nextActionDate }, { nextActionDate });
            }}
          />
        </td>
        <td className={tdClass}>
          <div className="flex items-center gap-1">
            <SheetTextCell
              value={deal.description ?? ''}
              placeholder="Notes"
              className="min-w-[12rem]"
              onCommit={(next) =>
                patchDeal(
                  deal.id,
                  { description: next.trim() || null },
                  { description: next.trim() || null },
                )
              }
            />
            <button
              type="button"
              className={`shrink-0 px-1 text-[11px] ${workspaceTextMuted} hover:text-[var(--workspace-shell-text)]`}
              onClick={() => onEditInstruction(deal)}
            >
              Open
            </button>
          </div>
        </td>
      </tr>
    );
  };

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col gap-4 px-4 pb-4 md:px-6 lg:px-8">
      {showRequirements ? (
        <section
          className={`flex min-h-0 min-w-0 flex-col overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] ${
            showInstructions ? 'max-h-[45vh] shrink-0' : 'flex-1'
          }`}
        >
          <SheetSectionHeader
            title="Requirements"
            count={visibleRequirements.length}
            totalCount={sortedRequirements.length}
            query={requirementQuery}
            placeholder="Search requirements…"
            onQueryChange={setRequirementQuery}
            sortLabel={sortDescription(
              requirementSort,
              REQUIREMENT_SORT_LABELS,
            )}
            onClearSort={() => setRequirementSort(null)}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <SortableTh
                    label="Updated"
                    sortKey="updated"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Company"
                    sortKey="company"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Contact"
                    sortKey="contact"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Tel"
                    sortKey="tel"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Email"
                    sortKey="email"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Use"
                    sortKey="use"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="FH / LH"
                    sortKey="tenure"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Size min"
                    sortKey="sizeMin"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Size max"
                    sortKey="sizeMax"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Location"
                    sortKey="location"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Details sent"
                    sortKey="detailsSent"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Stage"
                    sortKey="stage"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Notes"
                    sortKey="notes"
                    sort={requirementSort}
                    onSort={(key) =>
                      setRequirementSort((prev) => nextSheetSort(prev, key))
                    }
                    className="min-w-[16rem]"
                  />
                </tr>
              </thead>
              <tbody>
                {visibleRequirements.length === 0 ? (
                  <tr>
                    <td
                      colSpan={13}
                      className={`px-3 py-8 text-center text-sm ${workspaceTextMuted}`}
                    >
                      {sortedRequirements.length === 0
                        ? 'No requirements yet — add one to start tracking briefs.'
                        : 'No requirements match your search.'}
                    </td>
                  </tr>
                ) : (
                  displayRequirements.map((row) => {
                    const stageColour = wipStageColour(row.stage);
                    return (
                      <tr
                        key={row.id}
                        className="hover:bg-[var(--workspace-shell-sidebar-accent)]/25"
                        style={{
                          boxShadow: `inset 3px 0 0 ${stageColour.bar}`,
                        }}
                      >
                        <td className={`${tdClass} px-2`}>
                          <button
                            type="button"
                            className={`text-left text-xs underline-offset-2 hover:underline ${workspaceTextMuted}`}
                            onClick={() => onEditRequirement(row)}
                            title="Open full editor"
                          >
                            {formatDate(row.updatedAt)}
                          </button>
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.companyName ?? ''}
                            placeholder="Company"
                            className="min-w-[9rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { companyName: next.trim() || null },
                                { companyName: next.trim() || null },
                              )
                            }
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.contactName ?? ''}
                            placeholder="Contact"
                            className="min-w-[8rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { contactName: next.trim() || null },
                                { contactName: next.trim() || null },
                              )
                            }
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.contactPhone ?? ''}
                            placeholder="Tel"
                            className="min-w-[7rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { contactPhone: next.trim() || null },
                                { contactPhone: next.trim() || null },
                              )
                            }
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.contactEmail ?? ''}
                            placeholder="Email"
                            className="min-w-[10rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { contactEmail: next.trim() || null },
                                { contactEmail: next.trim() || null },
                              )
                            }
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.sector ?? ''}
                            placeholder="Gym, office…"
                            className="min-w-[8rem]"
                            onCommit={(next) => {
                              const sector = next.trim() || null;
                              const useClass =
                                normalizeRequirementUseClass(sector);
                              patchRequirement(
                                row.id,
                                { sector, useClass },
                                { sector, useClass },
                              );
                            }}
                          />
                        </td>
                        <td className={tdClass}>
                          <select
                            className={selectClass}
                            value={row.tenure ?? ''}
                            onChange={(e) => {
                              const raw = e.target.value;
                              const tenure =
                                raw === 'rent' ||
                                raw === 'buy' ||
                                raw === 'both'
                                  ? raw
                                  : null;
                              patchRequirement(row.id, { tenure }, { tenure });
                            }}
                          >
                            <option value="">—</option>
                            <option value="buy">FH</option>
                            <option value="rent">LH</option>
                            <option value="both">FH / LH</option>
                          </select>
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={
                              row.sizeMinSqft != null
                                ? String(row.sizeMinSqft)
                                : ''
                            }
                            placeholder="Min"
                            className="min-w-[5rem] tabular-nums"
                            onCommit={(next) => {
                              const sizeMinSqft = parseOptionalNumber(next);
                              patchRequirement(
                                row.id,
                                { sizeMinSqft },
                                { sizeMinSqft },
                              );
                            }}
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={
                              row.sizeMaxSqft != null
                                ? String(row.sizeMaxSqft)
                                : ''
                            }
                            placeholder="Max"
                            className="min-w-[5rem] tabular-nums"
                            onCommit={(next) => {
                              const sizeMaxSqft = parseOptionalNumber(next);
                              patchRequirement(
                                row.id,
                                { sizeMaxSqft },
                                { sizeMaxSqft },
                              );
                            }}
                          />
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.locationText ?? ''}
                            placeholder="Location"
                            className="min-w-[9rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { locationText: next.trim() || null },
                                { locationText: next.trim() || null },
                              )
                            }
                          />
                        </td>
                        <td className={tdClass}>
                          <input
                            type="checkbox"
                            className="mx-auto block h-4 w-4 accent-[var(--workspace-shell-accent)]"
                            checked={row.detailsSent}
                            title={row.detailsNote ?? undefined}
                            onChange={(e) => {
                              const detailsSent = e.target.checked;
                              patchRequirement(
                                row.id,
                                { detailsSent },
                                { detailsSent },
                              );
                            }}
                          />
                        </td>
                        <td className={tdClass}>
                          <select
                            className={selectClass}
                            style={{
                              color: stageColour.label,
                              borderColor: stageColour.bar,
                              background: stageColour.tint,
                            }}
                            value={row.stage}
                            onChange={(e) => {
                              const stage = e.target.value as RequirementStatus;
                              const boardPosition = nextEndPosition(
                                requirements
                                  .filter(
                                    (item) =>
                                      item.id !== row.id &&
                                      item.stage === stage,
                                  )
                                  .map((item) => item.boardPosition),
                              );
                              patchRequirement(
                                row.id,
                                { stage, boardPosition },
                                { stage, boardPosition },
                              );
                            }}
                          >
                            {REQUIREMENT_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {REQUIREMENT_STATUS_LABELS[status]}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className={tdClass}>
                          <SheetTextCell
                            value={row.notes ?? ''}
                            placeholder="Notes / timing…"
                            className="min-w-[16rem]"
                            onCommit={(next) =>
                              patchRequirement(
                                row.id,
                                { notes: next.trim() || null },
                                { notes: next.trim() || null },
                              )
                            }
                          />
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {showInstructions ? (
        <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
          <SheetSectionHeader
            title="Instructions"
            count={visibleDeals.length}
            totalCount={sortedDeals.length}
            query={instructionQuery}
            placeholder="Search instructions…"
            onQueryChange={setInstructionQuery}
            sortLabel={sortDescription(
              instructionSort,
              INSTRUCTION_SORT_LABELS,
            )}
            onClearSort={() => setInstructionSort(null)}
          />
          <div className="min-h-0 flex-1 overflow-auto">
            <table className="w-max min-w-full border-collapse text-sm">
              <thead>
                <tr>
                  <SortableTh
                    label="Title"
                    sortKey="title"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Company"
                    sortKey="company"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Contact"
                    sortKey="contact"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Disposal"
                    sortKey="disposal"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Value"
                    sortKey="value"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Stage"
                    sortKey="stage"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="AML"
                    sortKey="aml"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Next action"
                    sortKey="nextAction"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Due"
                    sortKey="due"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                  />
                  <SortableTh
                    label="Notes"
                    sortKey="notes"
                    sort={instructionSort}
                    onSort={(key) =>
                      setInstructionSort((prev) => nextSheetSort(prev, key))
                    }
                    className="min-w-[14rem]"
                  />
                </tr>
              </thead>
              <tbody>
                {visibleDeals.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className={`px-3 py-8 text-center text-sm ${workspaceTextMuted}`}
                    >
                      {sortedDeals.length === 0
                        ? 'No instructions.'
                        : 'No instructions match your search.'}
                    </td>
                  </tr>
                ) : flatDeals ? (
                  flatDeals.map(renderDealRow)
                ) : (
                  instructionStages.flatMap((stage) => {
                    const stageDeals = visibleDeals
                      .filter(
                        (deal) =>
                          normalizeCommercialPipelineStage(deal.stage) ===
                          stage.key,
                      )
                      .slice()
                      .sort(compareInstructionOrder);
                    if (instructionQuery.trim() && stageDeals.length === 0) {
                      return [];
                    }
                    const colour = wipStageColour(stage.key);
                    const forecast = instructionQuery.trim()
                      ? {
                          count: stageDeals.length,
                          fee: stageDeals.reduce(
                            (sum, deal) =>
                              sum +
                              (Number.isFinite(deal.value) ? deal.value : 0),
                            0,
                          ),
                        }
                      : wipStageForecast(stageForecasts, stage.key);
                    return [
                      <tr key={`${stage.key}-header`}>
                        <td
                          colSpan={10}
                          className="border-b border-[color:var(--workspace-shell-border)] px-3 py-2"
                          style={{
                            background: colour.tint,
                            boxShadow: `inset 3px 0 0 ${colour.bar}`,
                          }}
                        >
                          <div className="flex items-baseline justify-between gap-3">
                            <span
                              className="text-xs font-semibold tracking-wide"
                              style={{ color: colour.label }}
                            >
                              {stage.label}
                            </span>
                            <span
                              className="text-xs font-medium tabular-nums"
                              style={{ color: colour.label }}
                              data-test="wip-stage-forecast"
                            >
                              {formatWipStageForecast(forecast)}
                            </span>
                          </div>
                        </td>
                      </tr>,
                      ...stageDeals.map(renderDealRow),
                    ];
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}
