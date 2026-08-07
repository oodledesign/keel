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
import { MoreHorizontal, Pencil, Plus } from 'lucide-react';

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

import type {
  PipelineData,
  PipelineDeal,
} from '~/home/(user)/_lib/server/pipeline.loader';
import { AddDealDialog } from '~/home/(user)/pipeline/_components/add-deal-dialog';
import { EditDealDialog } from '~/home/(user)/pipeline/_components/edit-deal-dialog';
import type { PipelineListingOption } from '~/home/(user)/pipeline/_components/pipeline-board';
import { moveDealToStage } from '~/home/(user)/pipeline/actions';
import { CustomizePipelinePhasesDialog } from '~/home/[account]/pipeline/_components/customize-pipeline-phases-dialog';
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
import { scrollWheelDeltaToScrollParent } from '~/lib/scroll-passthrough';
import { workspaceBtnPrimaryMd } from '~/lib/workspace-ui';

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]';

const VIEW_OPTIONS: Array<{ key: WipBoardView; label: string }> = [
  { key: 'instructions', label: 'Instructions' },
  { key: 'requirements', label: 'Requirements' },
  { key: 'both', label: 'Both' },
];

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
  listings?: PipelineListingOption[];
  stageConfig?: PipelineStageConfigItem[];
  boardName?: string;
  onDealWon?: (deal: PipelineDeal) => void;
  onRequestCreateDisposal?: (deal: PipelineDeal) => void;
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

export function CommercialWipBoard({
  initialData,
  initialRequirements,
  accountSlug,
  accountId,
  listings = [],
  stageConfig,
  boardName = DEFAULT_COMMERCIAL_WIP_BOARD_NAME,
  onDealWon,
  onRequestCreateDisposal,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = parseWipBoardView(searchParams.get('view'));
  const createParam = searchParams.get('create');
  const createInstructionRequested = createParam === 'lead';
  // `?create=1` (optionally with `view=requirements`) opens the requirement modal
  const createRequirementRequested = createParam === '1';

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

  useEffect(() => {
    setDeals(initialData.deals);
  }, [initialData.deals]);

  useEffect(() => {
    setRequirements(initialRequirements);
  }, [initialRequirements]);

  const clearCreateQuery = useCallback(() => {
    if (!createParam) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('create');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [createParam, router]);

  const setView = useCallback(
    (next: WipBoardView) => {
      const url = new URL(window.location.href);
      if (next === 'instructions') {
        url.searchParams.delete('view');
      } else {
        url.searchParams.set('view', next);
      }
      router.replace(url.pathname + url.search, { scroll: false });
    },
    [router],
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

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] w-full flex-col gap-6 px-4 pt-6 pb-12 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs">
          {VIEW_OPTIONS.map((option) => (
            <button
              key={option.key}
              type="button"
              onClick={() => setView(option.key)}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${
                view === option.key
                  ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]'
                  : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
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
        onDealCreated={(deal) => setDeals((prev) => [deal, ...prev])}
        accountSlug={accountSlug}
        accountId={accountId}
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

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div
          ref={kanbanScrollRef}
          className="flex min-h-0 flex-1 gap-4 overflow-x-auto overscroll-x-contain pb-4"
        >
          {columns.map((column) => {
            const cards = cardsByStage.get(column.key) ?? [];
            return (
              <StageColumn
                key={column.key}
                stageKey={column.key}
                label={column.label}
                cards={cards}
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

        <DragOverlay dropAnimation={null}>
          {activeCard?.kind === 'instruction' ? (
            <InstructionCard
              deal={activeCard.deal}
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
  listingById,
  onEditInstruction,
  onEditRequirement,
}: {
  stageKey: string;
  label: string;
  cards: BoardCard[];
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
      className={`flex min-w-[260px] flex-1 flex-col transition-colors ${
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
  listing,
  onEdit,
  overlay = false,
}: {
  deal: PipelineDeal;
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
        listing={listing}
        onEdit={onEdit}
        overlay
      />
    );
  }

  return (
    <SortableInstructionCard deal={deal} listing={listing} onEdit={onEdit} />
  );
}

function SortableInstructionCard({
  deal,
  listing,
  onEdit,
}: {
  deal: PipelineDeal;
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
  listing,
  onEdit,
  overlay = false,
  ref,
  style,
  dragHandleProps,
}: {
  deal: PipelineDeal;
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
          {listingName ? (
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
          <span className="mb-1 inline-flex rounded-full bg-sky-500/15 px-2 py-0.5 text-[10px] font-medium text-sky-700 dark:text-sky-300">
            Requirement
          </span>
          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
            {applicantLabel(requirement)}
          </p>
          {requirement.locationText ? (
            <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
              {requirement.locationText}
            </p>
          ) : null}
          <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
            {size ? <span>{size}</span> : null}
            {tenure ? <span>{tenure}</span> : null}
            {budget ? <span>{budget}</span> : null}
          </div>
        </div>
        <button
          type="button"
          className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]"
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
