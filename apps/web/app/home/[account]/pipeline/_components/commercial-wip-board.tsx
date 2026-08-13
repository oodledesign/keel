'use client';

import {
  type CSSProperties,
  type HTMLAttributes,
  type Ref,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import { useRouter, useSearchParams } from 'next/navigation';

import Link from 'next/link';

import {
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  LayoutGrid,
  ListTree,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Pencil,
  Plus,
  Table2,
} from 'lucide-react';

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@kit/ui/alert-dialog';
import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';

import pathsConfig from '~/config/paths.config';
import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import { AddDealDialog } from '~/home/(user)/pipeline/_components/add-deal-dialog';
import { EditDealDialog } from '~/home/(user)/pipeline/_components/edit-deal-dialog';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { moveDealToStage } from '~/home/(user)/pipeline/actions';
import { CustomizePipelinePhasesDialog } from '~/home/[account]/pipeline/_components/customize-pipeline-phases-dialog';
import type { ClientOption } from '~/home/[account]/projects/_components/client-combobox';
import { RequirementFormModal } from '~/home/[account]/requirements/_components/requirement-form-modal';
import type { RequirementDraftPrefill } from '~/home/[account]/requirements/_lib/schema/requirements.schema';
import type { CommercialRequirement } from '~/home/[account]/requirements/_lib/server/requirements.service';
import { updateRequirement } from '~/home/[account]/requirements/_lib/server/server-actions';
import {
  COMMERCIAL_PIPELINE_LOST_STAGE,
  COMMERCIAL_PIPELINE_WON_STAGE,
  DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
  normalizeRequirementStage,
} from '~/lib/commercial/commercial-constants';
import {
  type PipelineStageConfigItem,
  isCommercialTerminalStage,
  normalizeCommercialPipelineStage,
  resolveCommercialPipelineBoardStages,
} from '~/lib/commercial/pipeline-stage-config';
import {
  type InstructionClosedChoice,
  type RequirementClosedChoice,
  WIP_SHARED_STATUSES,
  type WipBoardKind,
  type WipBoardView,
  type WipSharedStatus,
  cardCompositeId,
  fromSharedStatus,
  parseCardCompositeId,
  parseWipBoardView,
  sharedBoardStages,
  toSharedStatus,
} from '~/lib/commercial/wip-board-mapping';
import {
  REQUIREMENT_USE_CLASS_LABELS,
  REQUIREMENT_USE_CLASS_STYLES,
  normalizeRequirementUseClass,
} from '~/lib/commercial/requirement-use-class';
import { scrollWheelDeltaToScrollParent } from '~/lib/scroll-passthrough';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

import type { WipDeskActivityItem } from '../_lib/server/wip-attachments.actions';
import type { WipAttentionDigest } from '../_lib/server/wip-attention.loader';
import { WipLadderView } from './wip-ladder-view';
import { WipNeedsAttentionStrip } from './wip-needs-attention-strip';
import { WipRecentUpdatesStrip } from './wip-recent-updates-strip';
import { WipSheetView } from './wip-sheet-view';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]';

const VIEW_OPTIONS: Array<{ key: WipBoardView; label: string }> = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'both', label: 'Both' },
];

type WipLayoutMode = 'board' | 'sheet' | 'ladder';

function parseWipLayoutMode(raw: string | null): WipLayoutMode {
  if (raw === 'sheet' || raw === 'ladder') return raw;
  return 'board';
}

type BoardCard =
  | { kind: 'instruction'; deal: PipelineDeal }
  | { kind: 'requirement'; requirement: CommercialRequirement };

type PendingClosedMove = {
  kind: WipBoardKind;
  id: string;
  previousStage: string;
};

type Props = {
  initialData: PipelineData;
  initialRequirements: CommercialRequirement[];
  accountSlug: string;
  accountId: string;
  initialClients?: ClientOption[];
  listings?: PipelineListingOption[];
  stageConfig?: PipelineStageConfigItem[];
  boardName?: string;
  attentionDigest?: WipAttentionDigest | null;
  deskActivity?: WipDeskActivityItem[];
  onDealWon?: (deal: PipelineDeal) => void;
  onRequestCreateDisposal?: (deal: PipelineDeal) => void;
  onInstructionCreated?: (deal: PipelineDeal) => void;
  hideBoardTitle?: boolean;
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

function applicantLabel(req: CommercialRequirement) {
  return (
    req.companyName ||
    req.contactName ||
    req.contactEmail ||
    'Untitled requirement'
  );
}

function sizeLabel(req: CommercialRequirement) {
  if (req.sizeMinSqft == null && req.sizeMaxSqft == null) return null;
  if (req.sizeMinSqft != null && req.sizeMaxSqft != null) {
    return `${req.sizeMinSqft.toLocaleString('en-GB')}–${req.sizeMaxSqft.toLocaleString('en-GB')} ft²`;
  }
  const value = req.sizeMaxSqft ?? req.sizeMinSqft;
  return value != null ? `${value.toLocaleString('en-GB')} ft²` : null;
}

function budgetLabel(req: CommercialRequirement) {
  if (req.budgetMinPence == null && req.budgetMaxPence == null) return null;
  const min =
    req.budgetMinPence != null
      ? formatCurrency(req.budgetMinPence / 100)
      : null;
  const max =
    req.budgetMaxPence != null
      ? formatCurrency(req.budgetMaxPence / 100)
      : null;
  if (min && max) return `${min}–${max}`;
  return min ?? max;
}

function tenureLabel(tenure: CommercialRequirement['tenure']) {
  if (tenure === 'rent') return 'Rent';
  if (tenure === 'buy') return 'Buy';
  if (tenure === 'both') return 'Rent or buy';
  return null;
}

function isWonInstructionStage(stage: string) {
  return (
    stage === COMMERCIAL_PIPELINE_WON_STAGE ||
    stage === 'completed_exchanged' ||
    stage === 'won' ||
    stage === 'signed' ||
    stage === 'completed'
  );
}

function listingDetailHref(accountSlug: string, listingId: string) {
  return pathsConfig.app.accountListingDetail
    .replace('[account]', accountSlug)
    .replace('[id]', listingId);
}

export function CommercialWipBoard({
  initialData,
  initialRequirements,
  accountSlug,
  accountId,
  initialClients = [],
  listings = [],
  stageConfig,
  boardName = DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
  attentionDigest = null,
  deskActivity: initialDeskActivity = [],
  onDealWon,
  onRequestCreateDisposal,
  onInstructionCreated,
  hideBoardTitle = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createParam = searchParams.get('create');
  // Optimistic view: tab highlight + board columns update immediately. URL is
  // synced with history.replaceState so App Router doesn't refetch the whole
  // pipeline RSC payload on every tab click (that was the lag).
  const [view, setViewState] = useState<WipBoardView>(() =>
    parseWipBoardView(searchParams.get('view')),
  );
  const [layout, setLayoutState] = useState<WipLayoutMode>(() =>
    parseWipLayoutMode(searchParams.get('layout')),
  );
  const [deskActivity, setDeskActivity] =
    useState<WipDeskActivityItem[]>(initialDeskActivity);
  const [createDismissed, setCreateDismissed] = useState(false);
  const [isViewSwitching, setIsViewSwitching] = useState(false);
  const viewSwitchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const createInstructionRequested = !createDismissed && createParam === 'lead';
  // `?create=1` (optionally with `view=requirements`) opens the requirement modal
  const createRequirementRequested = !createDismissed && createParam === '1';

  const [deals, setDeals] = useState<PipelineDeal[]>(initialData.deals);
  const [requirements, setRequirements] = useState(initialRequirements);
  const [activeCard, setActiveCard] = useState<BoardCard | null>(null);
  const [dealToEdit, setDealToEdit] = useState<PipelineDeal | null>(null);
  const [editDealOpen, setEditDealOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [requirementModalOpen, setRequirementModalOpen] = useState(false);
  const [editingRequirement, setEditingRequirement] =
    useState<CommercialRequirement | null>(null);
  const [requirementDraft, setRequirementDraft] =
    useState<RequirementDraftPrefill | null>(null);
  const [openRequirementPaste, setOpenRequirementPaste] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [pendingClosed, setPendingClosed] = useState<PendingClosedMove | null>(
    null,
  );
  const [, startTransition] = useTransition();
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    if (!fullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreen(false);
    };
    window.addEventListener('keydown', onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [fullscreen]);

  useEffect(() => {
    setDeals(initialData.deals);
  }, [initialData.deals]);

  useEffect(() => {
    setRequirements(initialRequirements);
  }, [initialRequirements]);

  useEffect(() => {
    setDeskActivity(initialDeskActivity);
  }, [initialDeskActivity]);

  // Do not sync view from useSearchParams after mount — Next's router URL can
  // lag behind history.replaceState, and router.refresh() would snap the tab
  // back to Instructions. Initial state + popstate cover deep links / back.

  useEffect(() => {
    if (createParam === '1' || createParam === 'lead') {
      setCreateDismissed(false);
    }
  }, [createParam]);

  useEffect(() => {
    const onPopState = () => {
      const params = new URLSearchParams(window.location.search);
      setViewState(parseWipBoardView(params.get('view')));
      setLayoutState(parseWipLayoutMode(params.get('layout')));
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    return () => {
      if (viewSwitchTimerRef.current) {
        clearTimeout(viewSwitchTimerRef.current);
      }
    };
  }, []);

  const replaceQueryShallow = useCallback((mutate: (url: URL) => void) => {
    const url = new URL(window.location.href);
    mutate(url);
    window.history.replaceState(
      window.history.state,
      '',
      url.pathname + url.search,
    );
  }, []);

  const clearCreateQuery = useCallback(() => {
    setCreateDismissed(true);
    if (!createParam) return;
    replaceQueryShallow((url) => {
      url.searchParams.delete('create');
    });
  }, [createParam, replaceQueryShallow]);

  const setView = useCallback(
    (next: WipBoardView) => {
      if (next === view) return;

      setViewState(next);
      setIsViewSwitching(true);
      if (viewSwitchTimerRef.current) {
        clearTimeout(viewSwitchTimerRef.current);
      }
      viewSwitchTimerRef.current = setTimeout(() => {
        setIsViewSwitching(false);
        viewSwitchTimerRef.current = null;
      }, 220);

      replaceQueryShallow((url) => {
        if (next === 'instructions') {
          url.searchParams.delete('view');
        } else {
          url.searchParams.set('view', next);
        }
      });
    },
    [replaceQueryShallow, view],
  );

  const setLayout = useCallback(
    (next: WipLayoutMode) => {
      if (next === layout) return;
      setLayoutState(next);
      replaceQueryShallow((url) => {
        if (next === 'board') {
          url.searchParams.delete('layout');
        } else {
          url.searchParams.set('layout', next);
        }
      });
    },
    [layout, replaceQueryShallow],
  );

  const instructionStages = useMemo(
    () =>
      resolveCommercialPipelineBoardStages({
        stored: stageConfig,
        dealStages: deals.map((deal) => deal.stage),
      }),
    [stageConfig, deals],
  );

  const selectableInstructionStages = useMemo(() => {
    const visible = resolveCommercialPipelineBoardStages({
      stored: stageConfig,
    }).filter((stage) => !stage.forceVisible);

    return (visible.length > 0 ? visible : instructionStages).map((stage) => ({
      key: stage.key,
      label: stage.label,
    }));
  }, [stageConfig, instructionStages]);

  const columns = useMemo(() => {
    if (view === 'instructions') {
      return instructionStages.map((stage) => ({
        key: stage.key,
        label: stage.label,
      }));
    }
    if (view === 'requirements') {
      return REQUIREMENT_STATUSES.map((key) => ({
        key,
        label: REQUIREMENT_STATUS_LABELS[key],
      }));
    }
    return sharedBoardStages();
  }, [view, instructionStages]);

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) {
      map.set(listing.id, listing);
    }
    return map;
  }, [listings]);

  const cardsByStage = useMemo(() => {
    const map = new Map<string, BoardCard[]>();
    for (const column of columns) {
      map.set(column.key, []);
    }

    if (view === 'instructions' || view === 'both') {
      for (const deal of deals) {
        const key =
          view === 'both'
            ? toSharedStatus('instruction', deal.stage)
            : normalizeCommercialPipelineStage(deal.stage);
        const list = map.get(key);
        if (list) list.push({ kind: 'instruction', deal });
        else map.set(key, [{ kind: 'instruction', deal }]);
      }
    }

    if (view === 'requirements' || view === 'both') {
      for (const requirement of requirements) {
        const key =
          view === 'both'
            ? toSharedStatus('requirement', requirement.stage)
            : normalizeRequirementStage(requirement.stage);
        const list = map.get(key);
        if (list) list.push({ kind: 'requirement', requirement });
        else map.set(key, [{ kind: 'requirement', requirement }]);
      }
    }

    return map;
  }, [columns, deals, requirements, view]);

  useEffect(() => {
    const kanban = kanbanScrollRef.current;
    if (!kanban) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) return;
      scrollWheelDeltaToScrollParent(kanban, event);
    };

    kanban.addEventListener('wheel', onWheel, { passive: false });
    return () => kanban.removeEventListener('wheel', onWheel);
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const persistInstructionStage = useCallback(
    (dealId: string, nextStage: string, previousStage: string) => {
      const current = deals.find((deal) => deal.id === dealId);
      if (!current) return;

      const updated = { ...current, stage: nextStage };
      setDeals((prev) =>
        prev.map((deal) => (deal.id === dealId ? updated : deal)),
      );

      startTransition(async () => {
        try {
          const result = await moveDealToStage(dealId, nextStage, {
            accountSlug,
          });
          if (!result.success) {
            setDeals((prev) =>
              prev.map((deal) =>
                deal.id === dealId ? { ...deal, stage: previousStage } : deal,
              ),
            );
            toast.error(result.error ?? 'Could not update instruction stage');
            return;
          }
          if (isWonInstructionStage(nextStage)) {
            onDealWon?.(updated);
          }
        } catch (error) {
          setDeals((prev) =>
            prev.map((deal) =>
              deal.id === dealId ? { ...deal, stage: previousStage } : deal,
            ),
          );
          toast.error(
            error instanceof Error
              ? error.message
              : 'Could not update instruction stage',
          );
        }
      });
    },
    [accountSlug, deals, onDealWon],
  );

  const persistRequirementStage = useCallback(
    (
      requirementId: string,
      nextStage: RequirementStatus,
      previousStage: RequirementStatus,
    ) => {
      setRequirements((prev) =>
        prev.map((item) =>
          item.id === requirementId ? { ...item, stage: nextStage } : item,
        ),
      );

      startTransition(async () => {
        try {
          await updateRequirement({
            requirementId,
            accountId,
            stage: nextStage,
          });
          router.refresh();
        } catch {
          setRequirements((prev) =>
            prev.map((item) =>
              item.id === requirementId
                ? { ...item, stage: previousStage }
                : item,
            ),
          );
          toast.error('Could not update requirement stage');
        }
      });
    },
    [accountId, router],
  );

  const resolveDropStageKey = useCallback(
    (overId: string, overStage?: string): string | null => {
      if (overStage) return overStage;
      if (overId.startsWith('stage-')) return overId.slice('stage-'.length);

      const parsed = parseCardCompositeId(overId);
      if (!parsed) return null;

      if (parsed.kind === 'instruction') {
        const deal = deals.find((item) => item.id === parsed.id);
        if (!deal) return null;
        return view === 'both'
          ? toSharedStatus('instruction', deal.stage)
          : normalizeCommercialPipelineStage(deal.stage);
      }

      const requirement = requirements.find((item) => item.id === parsed.id);
      if (!requirement) return null;
      return view === 'both'
        ? toSharedStatus('requirement', requirement.stage)
        : normalizeRequirementStage(requirement.stage);
    },
    [deals, requirements, view],
  );

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const parsed = parseCardCompositeId(String(event.active.id));
      if (!parsed) {
        setActiveCard(null);
        return;
      }
      if (parsed.kind === 'instruction') {
        const deal = deals.find((item) => item.id === parsed.id) ?? null;
        setActiveCard(deal ? { kind: 'instruction', deal } : null);
        return;
      }
      const requirement =
        requirements.find((item) => item.id === parsed.id) ?? null;
      setActiveCard(requirement ? { kind: 'requirement', requirement } : null);
    },
    [deals, requirements],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveCard(null);
      const { active, over } = event;
      if (!over || pendingClosed) return;

      const parsed = parseCardCompositeId(String(active.id));
      if (!parsed) return;

      const overId = String(over.id);
      const overStage = (over.data.current as { stage?: string } | undefined)
        ?.stage;
      const dropKey = resolveDropStageKey(overId, overStage);
      if (!dropKey) return;

      if (view === 'instructions') {
        if (parsed.kind !== 'instruction') return;
        const deal = deals.find((item) => item.id === parsed.id);
        if (!deal) return;
        const currentKey = normalizeCommercialPipelineStage(deal.stage);
        if (currentKey === dropKey) return;
        persistInstructionStage(deal.id, dropKey, deal.stage);
        return;
      }

      if (view === 'requirements') {
        if (parsed.kind !== 'requirement') return;
        const requirement = requirements.find((item) => item.id === parsed.id);
        if (!requirement) return;
        const nextStage = dropKey as RequirementStatus;
        if (!REQUIREMENT_STATUSES.includes(nextStage)) return;
        if (normalizeRequirementStage(requirement.stage) === nextStage) return;
        persistRequirementStage(requirement.id, nextStage, requirement.stage);
        return;
      }

      // both — shared columns
      if (!(WIP_SHARED_STATUSES as readonly string[]).includes(dropKey)) {
        return;
      }
      const shared = dropKey as WipSharedStatus;
      if (parsed.kind === 'instruction') {
        const deal = deals.find((item) => item.id === parsed.id);
        if (!deal) return;
        const currentShared = toSharedStatus('instruction', deal.stage);
        if (currentShared === shared) return;

        if (shared === 'closed') {
          setPendingClosed({
            kind: 'instruction',
            id: deal.id,
            previousStage: deal.stage,
          });
          return;
        }

        const nextStage = fromSharedStatus('instruction', shared);
        persistInstructionStage(deal.id, nextStage, deal.stage);
        return;
      }

      const requirement = requirements.find((item) => item.id === parsed.id);
      if (!requirement) return;
      const currentShared = toSharedStatus('requirement', requirement.stage);
      if (currentShared === shared) return;

      if (shared === 'closed') {
        setPendingClosed({
          kind: 'requirement',
          id: requirement.id,
          previousStage: requirement.stage,
        });
        return;
      }

      const nextStage = fromSharedStatus('requirement', shared);
      persistRequirementStage(requirement.id, nextStage, requirement.stage);
    },
    [
      deals,
      requirements,
      view,
      pendingClosed,
      resolveDropStageKey,
      persistInstructionStage,
      persistRequirementStage,
    ],
  );

  const confirmClosedChoice = useCallback(
    (choice: InstructionClosedChoice | RequirementClosedChoice) => {
      if (!pendingClosed) return;
      const pending = pendingClosed;
      setPendingClosed(null);

      if (pending.kind === 'instruction') {
        const nextStage = fromSharedStatus(
          'instruction',
          'closed',
          choice as InstructionClosedChoice,
        );
        persistInstructionStage(pending.id, nextStage, pending.previousStage);
        return;
      }

      const nextStage = fromSharedStatus(
        'requirement',
        'closed',
        choice as RequirementClosedChoice,
      );
      persistRequirementStage(
        pending.id,
        nextStage,
        normalizeRequirementStage(pending.previousStage),
      );
    },
    [pendingClosed, persistInstructionStage, persistRequirementStage],
  );

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const activeInstructions = useMemo(
    () => deals.filter((deal) => !isCommercialTerminalStage(deal.stage)),
    [deals],
  );
  const instructionCount = activeInstructions.length;
  const requirementCount = requirements.length;
  const totalValue = useMemo(
    () => activeInstructions.reduce((sum, deal) => sum + (deal.value || 0), 0),
    [activeInstructions],
  );

  const tabCounts: Record<WipBoardView, number | null> = {
    instructions: instructionCount,
    requirements: requirementCount,
    both: instructionCount + requirementCount,
  };

  return (
    <div
      className={
        fullscreen
          ? 'fixed inset-0 z-[80] flex w-full min-w-0 flex-col overflow-hidden bg-[var(--workspace-shell-canvas,var(--ozer-surface-canvas))] text-[var(--workspace-shell-text)]'
          : `flex min-h-0 w-full min-w-0 flex-1 flex-col pb-4 text-[var(--workspace-shell-text)] ${
              hideBoardTitle ? 'gap-2 pt-0' : 'gap-6 pt-6'
            }`
      }
    >
      <div
        className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-4 pt-1 md:px-6 lg:px-8 ${
          fullscreen ? 'shrink-0 border-b border-[color:var(--workspace-shell-border)] py-3' : ''
        }`}
      >
        <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs">
          {VIEW_OPTIONS.map((option) => {
            const count = tabCounts[option.key];
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={view === option.key}
                onClick={() => setView(option.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 font-medium transition-colors ${
                  view === option.key
                    ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                    : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
                }`}
              >
                <span>{option.label}</span>
                {count != null ? (
                  <span
                    className={`tabular-nums ${
                      view === option.key
                        ? 'text-[var(--workspace-shell-text)]/70'
                        : 'text-[var(--workspace-shell-text-muted)]'
                    }`}
                  >
                    {count}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>

        <p className="text-sm text-[var(--workspace-shell-text-muted)] tabular-nums">
          {formatCurrency(totalValue)}
          <span className="ml-1.5 text-[var(--workspace-shell-text-muted)]/80">
            total value
          </span>
        </p>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs">
            <button
              type="button"
              aria-pressed={layout === 'board'}
              onClick={() => setLayout('board')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                layout === 'board'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Board
            </button>
            <button
              type="button"
              aria-pressed={layout === 'sheet'}
              onClick={() => setLayout('sheet')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                layout === 'sheet'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <Table2 className="h-3.5 w-3.5" />
              Sheet
            </button>
            <button
              type="button"
              aria-pressed={layout === 'ladder'}
              onClick={() => setLayout('ladder')}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors ${
                layout === 'ladder'
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              <ListTree className="h-3.5 w-3.5" />
              Ladder
            </button>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80"
            onClick={() => setFullscreen((value) => !value)}
            aria-pressed={fullscreen}
            title={fullscreen ? 'Exit full screen (Esc)' : 'Full screen'}
          >
            {fullscreen ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="h-4 w-4" />
            )}
            <span className="sr-only">
              {fullscreen ? 'Exit full screen' : 'Full screen'}
            </span>
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80"
              >
                <MoreHorizontal className="h-4 w-4" />
                <span className="sr-only">More actions</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={() => setCustomizeOpen(true)}>
                Customize board
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setAddDealOpen(true);
                }}
              >
                Add instruction
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setEditingRequirement(null);
                  setRequirementDraft(null);
                  setOpenRequirementPaste(false);
                  setRequirementModalOpen(true);
                }}
              >
                Add requirement
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setEditingRequirement(null);
                  setRequirementDraft(null);
                  setOpenRequirementPaste(true);
                  setRequirementModalOpen(true);
                }}
              >
                Draft requirement from email…
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            type="button"
            className={workspaceBtnPrimaryMd}
            onClick={() => {
              if (view === 'requirements') {
                setEditingRequirement(null);
                setRequirementDraft(null);
                setOpenRequirementPaste(false);
                setRequirementModalOpen(true);
              } else {
                setAddDealOpen(true);
              }
            }}
          >
            <Plus className="h-4 w-4" />
            {view === 'requirements' ? 'Add requirement' : 'Add instruction'}
          </Button>
        </div>
      </div>

      {attentionDigest ? (
        <WipNeedsAttentionStrip
          accountSlug={accountSlug}
          digest={attentionDigest}
        />
      ) : null}

      <WipRecentUpdatesStrip
        items={deskActivity}
        onOpenInstruction={(pipelineDealId) => {
          const deal = deals.find((item) => item.id === pipelineDealId);
          if (!deal) return;
          setDealToEdit(deal);
          setEditDealOpen(true);
        }}
      />

      <CustomizePipelinePhasesDialog
        accountId={accountId}
        accountSlug={accountSlug}
        initialStages={stageConfig ?? []}
        initialBoardName={boardName}
        open={customizeOpen}
        onOpenChange={setCustomizeOpen}
        showTrigger={false}
      />

      <AddDealDialog
        businesses={initialData.businesses}
        onDealCreated={(deal) => {
          setDeals((prev) => [deal, ...prev]);
          if (!deal.commercialListingId) {
            onInstructionCreated?.(deal);
          }
        }}
        accountSlug={accountSlug}
        accountId={accountId}
        initialClients={initialClients}
        stages={selectableInstructionStages}
        defaultStage={selectableInstructionStages[0]?.key}
        listings={listings}
        commercial
        showTrigger={false}
        open={addDealOpen || createInstructionRequested}
        onOpenChange={(open) => {
          setAddDealOpen(open);
          if (!open) clearCreateQuery();
        }}
      />

      <EditDealDialog
        deal={dealToEdit}
        businesses={initialData.businesses}
        open={editDealOpen}
        onOpenChange={(open) => {
          setEditDealOpen(open);
          if (!open) setDealToEdit(null);
        }}
        onDealUpdated={(updated) => {
          setDeals((prev) =>
            prev.map((deal) => (deal.id === updated.id ? updated : deal)),
          );
          setEditDealOpen(false);
          setDealToEdit(null);
          if (isWonInstructionStage(updated.stage)) {
            onDealWon?.(updated);
          }
        }}
        accountSlug={accountSlug}
        accountId={accountId}
        initialClients={initialClients}
        stages={selectableInstructionStages}
        listings={listings}
        commercial
        onRequestCreateDisposal={
          onRequestCreateDisposal
            ? (deal) => {
                setEditDealOpen(false);
                setDealToEdit(null);
                onRequestCreateDisposal(deal);
              }
            : undefined
        }
      />

      <RequirementFormModal
        open={requirementModalOpen || createRequirementRequested}
        onClose={() => {
          setRequirementModalOpen(false);
          setEditingRequirement(null);
          setRequirementDraft(null);
          setOpenRequirementPaste(false);
          clearCreateQuery();
        }}
        accountId={accountId}
        accountSlug={accountSlug}
        requirement={editingRequirement}
        initialDraft={requirementDraft}
        openPastePanel={openRequirementPaste}
        onSaved={() => {
          setRequirementModalOpen(false);
          setEditingRequirement(null);
          setRequirementDraft(null);
          setOpenRequirementPaste(false);
          clearCreateQuery();
          handleSaved();
        }}
      />

      {layout === 'sheet' ? (
        <WipSheetView
          accountId={accountId}
          accountSlug={accountSlug}
          view={view}
          deals={deals}
          requirements={requirements}
          instructionStages={selectableInstructionStages}
          listings={listings}
          onDealsChange={setDeals}
          onRequirementsChange={setRequirements}
          onEditRequirement={(requirement) => {
            setEditingRequirement(requirement);
            setRequirementDraft(null);
            setOpenRequirementPaste(false);
            setRequirementModalOpen(true);
          }}
          onEditInstruction={(deal) => {
            setDealToEdit(deal);
            setEditDealOpen(true);
          }}
        />
      ) : layout === 'ladder' ? (
        <WipLadderView
          accountId={accountId}
          accountSlug={accountSlug}
          deals={deals}
          stages={instructionStages.map((stage) => ({
            key: stage.key,
            label: stage.label,
          }))}
          deskActivity={deskActivity}
          listings={listings}
          onDealsChange={setDeals}
          onEditInstruction={(deal) => {
            setDealToEdit(deal);
            setEditDealOpen(true);
          }}
          onDealWon={onDealWon}
          onActivityChanged={() => router.refresh()}
        />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div
            ref={kanbanScrollRef}
            className={`min-h-0 w-full min-w-0 flex-1 overflow-x-auto overscroll-x-contain pb-4 transition-opacity duration-150 ease-out ${
              isViewSwitching ? 'opacity-55' : 'opacity-100'
            }`}
            aria-busy={isViewSwitching}
          >
            <div className="flex w-max min-w-full gap-4 px-4 md:px-6 lg:px-8">
              {columns.map((column) => {
                const cards = cardsByStage.get(column.key) ?? [];
                return (
                  <StageColumn
                    key={`${view}-${column.key}`}
                    stageKey={column.key}
                    label={column.label}
                    cards={cards}
                    accountSlug={accountSlug}
                    listingById={listingById}
                    onEditInstruction={(deal) => {
                      setDealToEdit(deal);
                      setEditDealOpen(true);
                    }}
                    onEditRequirement={(requirement) => {
                      setEditingRequirement(requirement);
                      setRequirementDraft(null);
                      setRequirementModalOpen(true);
                    }}
                  />
                );
              })}
            </div>
          </div>

          <DragOverlay dropAnimation={null}>
            {activeCard?.kind === 'instruction' ? (
              <InstructionCard
                deal={activeCard.deal}
                accountSlug={accountSlug}
                listing={
                  activeCard.deal.commercialListingId
                    ? (listingById.get(activeCard.deal.commercialListingId) ??
                      null)
                    : null
                }
                onEdit={() => {}}
                overlay
              />
            ) : null}
            {activeCard?.kind === 'requirement' ? (
              <RequirementCard
                requirement={activeCard.requirement}
                onEdit={() => {}}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <AlertDialog
        open={pendingClosed != null}
        onOpenChange={(open) => {
          if (!open) setPendingClosed(null);
        }}
      >
        <AlertDialogContent className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]">
          <AlertDialogHeader>
            <AlertDialogTitle>
              {pendingClosed?.kind === 'requirement'
                ? 'Mark requirement closed'
                : 'Mark instruction closed'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {pendingClosed?.kind === 'requirement'
                ? 'Was this requirement fulfilled or withdrawn?'
                : 'Was this instruction completed / exchanged, or did it fall through?'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col gap-2 sm:flex-col">
            {pendingClosed?.kind === 'instruction' ? (
              <>
                <Button
                  type="button"
                  className={workspaceBtnPrimaryMd}
                  onClick={() =>
                    confirmClosedChoice(COMMERCIAL_PIPELINE_WON_STAGE)
                  }
                >
                  Completed / Exchanged
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    confirmClosedChoice(COMMERCIAL_PIPELINE_LOST_STAGE)
                  }
                >
                  Fallen through
                </Button>
              </>
            ) : (
              <>
                <Button
                  type="button"
                  className={workspaceBtnPrimaryMd}
                  onClick={() => confirmClosedChoice('fulfilled')}
                >
                  Fulfilled
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => confirmClosedChoice('withdrawn')}
                >
                  Withdrawn
                </Button>
              </>
            )}
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function StageColumn({
  stageKey,
  label,
  cards,
  accountSlug,
  listingById,
  onEditInstruction,
  onEditRequirement,
}: {
  stageKey: string;
  label: string;
  cards: BoardCard[];
  accountSlug: string;
  listingById: Map<string, PipelineListingOption>;
  onEditInstruction: (deal: PipelineDeal) => void;
  onEditRequirement: (requirement: CommercialRequirement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stageKey}`,
    data: { stage: stageKey },
  });

  const sortableIds = cards.map((card) =>
    card.kind === 'instruction'
      ? cardCompositeId('instruction', card.deal.id)
      : cardCompositeId('requirement', card.requirement.id),
  );

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[280px] shrink-0 flex-col transition-colors ${
        isOver ? 'rounded-2xl bg-[var(--workspace-shell-sidebar-accent)]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--workspace-shell-text)]">
            {label}
          </span>
          <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {cards.length}
          </span>
        </div>
      </div>

      <SortableContext
        items={sortableIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {cards.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              Drop here
            </div>
          ) : (
            cards.map((card) =>
              card.kind === 'instruction' ? (
                <InstructionCard
                  key={cardCompositeId('instruction', card.deal.id)}
                  deal={card.deal}
                  accountSlug={accountSlug}
                  listing={
                    card.deal.commercialListingId
                      ? (listingById.get(card.deal.commercialListingId) ?? null)
                      : null
                  }
                  onEdit={() => onEditInstruction(card.deal)}
                />
              ) : (
                <RequirementCard
                  key={cardCompositeId('requirement', card.requirement.id)}
                  requirement={card.requirement}
                  onEdit={() => onEditRequirement(card.requirement)}
                />
              ),
            )
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function InstructionCard({
  deal,
  accountSlug,
  listing,
  onEdit,
  overlay = false,
}: {
  deal: PipelineDeal;
  accountSlug: string;
  listing?: PipelineListingOption | null;
  onEdit: () => void;
  overlay?: boolean;
}) {
  // DragOverlay must not call useSortable with the same id as the source card —
  // duplicate sortable registration crashes the DndContext (error boundary).
  if (overlay) {
    return (
      <InstructionCardBody
        deal={deal}
        accountSlug={accountSlug}
        listing={listing}
        onEdit={onEdit}
        overlay
      />
    );
  }

  return (
    <SortableInstructionCard
      deal={deal}
      accountSlug={accountSlug}
      listing={listing}
      onEdit={onEdit}
    />
  );
}

function SortableInstructionCard({
  deal,
  accountSlug,
  listing,
  onEdit,
}: {
  deal: PipelineDeal;
  accountSlug: string;
  listing?: PipelineListingOption | null;
  onEdit: () => void;
}) {
  const id = cardCompositeId('instruction', deal.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <InstructionCardBody
      deal={deal}
      accountSlug={accountSlug}
      listing={listing}
      onEdit={onEdit}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

const InstructionCardBody = ({
  deal,
  accountSlug,
  listing,
  onEdit,
  overlay = false,
  ref,
  style,
  dragHandleProps,
}: {
  deal: PipelineDeal;
  accountSlug: string;
  listing?: PipelineListingOption | null;
  onEdit: () => void;
  overlay?: boolean;
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
}) => {
  const title = deal.clientId
    ? deal.clientName || deal.contactName
    : deal.contactName || deal.clientName;
  const clientLabel = deal.clientName || deal.contactName || '';
  const listingName = listing?.name?.trim() || null;
  const listingId = deal.commercialListingId;
  const companySubtitle =
    deal.companyName &&
    deal.companyName !== clientLabel &&
    deal.companyName !== listingName
      ? deal.companyName
      : null;

  const disposalType = listing?.disposalType as DisposalType | undefined;
  const rent =
    listing?.askingRentPence != null
      ? formatCurrency(listing.askingRentPence / 100)
      : null;
  const price =
    listing?.askingPricePence != null
      ? formatCurrency(listing.askingPricePence / 100)
      : null;
  const asking = rent ? `${rent} pa` : price;

  return (
    <div
      ref={ref}
      style={style}
      className={`${panelClass} cursor-grab p-4 active:cursor-grabbing ${
        overlay
          ? 'scale-105 rotate-2 shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]'
          : ''
      }`}
      {...(dragHandleProps ?? {})}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="mb-1 inline-flex rounded-full bg-[color:var(--ozer-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[color:var(--ozer-accent)]">
            Instruction
          </span>
          <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
            {title}
          </p>
          {companySubtitle ? (
            <p className="text-xs text-[var(--workspace-shell-text-muted)]">
              {companySubtitle}
            </p>
          ) : null}
          {listingId && listingName ? (
            <Link
              href={listingDetailHref(accountSlug, listingId)}
              onClick={(event) => event.stopPropagation()}
              onPointerDown={(event) => event.stopPropagation()}
              className="mt-0.5 inline-flex max-w-full items-center gap-1 truncate text-xs font-medium text-[var(--ozer-info)] underline-offset-2 hover:underline"
            >
              {listingName}
              <span className="shrink-0 text-[10px] font-normal opacity-80">
                Open disposal
              </span>
            </Link>
          ) : listingName ? (
            <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
              {listingName}
            </p>
          ) : null}
          {disposalType || asking ? (
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {disposalType && DISPOSAL_TYPE_LABELS[disposalType] ? (
                <span
                  className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ${DISPOSAL_TYPE_BADGE_CLASS[disposalType]}`}
                >
                  {DISPOSAL_TYPE_LABELS[disposalType]}
                </span>
              ) : null}
              {asking ? (
                <span className="text-[11px] font-medium text-[var(--workspace-shell-text)]/70">
                  {asking}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
          aria-label="Edit instruction"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

function RequirementCard({
  requirement,
  onEdit,
  overlay = false,
}: {
  requirement: CommercialRequirement;
  onEdit: () => void;
  overlay?: boolean;
}) {
  if (overlay) {
    return (
      <RequirementCardBody requirement={requirement} onEdit={onEdit} overlay />
    );
  }

  return <SortableRequirementCard requirement={requirement} onEdit={onEdit} />;
}

function SortableRequirementCard({
  requirement,
  onEdit,
}: {
  requirement: CommercialRequirement;
  onEdit: () => void;
}) {
  const id = cardCompositeId('requirement', requirement.id);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <RequirementCardBody
      requirement={requirement}
      onEdit={onEdit}
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      dragHandleProps={{ ...attributes, ...listeners }}
    />
  );
}

const RequirementCardBody = ({
  requirement,
  onEdit,
  overlay = false,
  ref,
  style,
  dragHandleProps,
}: {
  requirement: CommercialRequirement;
  onEdit: () => void;
  overlay?: boolean;
  ref?: Ref<HTMLDivElement>;
  style?: CSSProperties;
  dragHandleProps?: HTMLAttributes<HTMLElement>;
}) => {
  const size = sizeLabel(requirement);
  const budget = budgetLabel(requirement);
  const tenure = tenureLabel(requirement.tenure);
  const useClassKey = normalizeRequirementUseClass(requirement.useClass);
  const useClassStyle = useClassKey
    ? REQUIREMENT_USE_CLASS_STYLES[useClassKey]
    : null;

  return (
    <div
      ref={ref}
      style={{
        ...style,
        ...(useClassStyle
          ? {
              backgroundColor: useClassStyle.background,
              color: useClassStyle.color,
              borderColor: 'transparent',
            }
          : null),
      }}
      className={`${panelClass} cursor-grab p-4 active:cursor-grabbing ${
        overlay
          ? 'scale-105 rotate-2 shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]'
          : ''
      }`}
      {...(dragHandleProps ?? {})}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span
            className="mb-1 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium"
            style={
              useClassStyle
                ? {
                    backgroundColor: 'rgba(0,0,0,0.08)',
                    color: useClassStyle.color,
                  }
                : undefined
            }
          >
            {useClassKey
              ? REQUIREMENT_USE_CLASS_LABELS[useClassKey]
              : 'Requirement'}
          </span>
          <p
            className={`truncate text-sm font-medium ${useClassStyle ? '' : 'text-[var(--workspace-shell-text)]'}`}
          >
            {applicantLabel(requirement)}
          </p>
          {requirement.locationText ? (
            <p
              className={`mt-0.5 truncate text-xs ${useClassStyle ? 'opacity-80' : 'text-[var(--workspace-shell-text-muted)]'}`}
            >
              {requirement.locationText}
            </p>
          ) : null}
          <div
            className={`mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs ${useClassStyle ? 'opacity-80' : 'text-[var(--workspace-shell-text-muted)]'}`}
          >
            {size ? <span>{size}</span> : null}
            {tenure ? <span>{tenure}</span> : null}
            {budget ? <span>{budget}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className={`shrink-0 ${useClassStyle ? 'opacity-70 hover:opacity-100' : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          aria-label="Edit requirement"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};
