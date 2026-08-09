'use client';

import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from 'react';

import Link from 'next/link';
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
import {
  ArrowRight,
  DollarSign,
  Download,
  Linkedin,
  MoreHorizontal,
  Phone,
  Send,
  Sparkles,
  Trophy,
  X,
} from 'lucide-react';

import { Button } from '@kit/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/dropdown-menu';
import { toast } from '@kit/ui/sonner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/tooltip';

import pathsConfig from '~/config/paths.config';
import { CustomizePipelinePhasesDialog } from '~/home/[account]/pipeline/_components/customize-pipeline-phases-dialog';
import type { ClientOption } from '~/home/[account]/projects/_components/client-combobox';
import {
  COMMERCIAL_PIPELINE_LOST_STAGE,
  COMMERCIAL_PIPELINE_WON_STAGE,
  DISPOSAL_TYPE_BADGE_CLASS,
  DISPOSAL_TYPE_LABELS,
  type DisposalType,
} from '~/lib/commercial/commercial-constants';
import {
  type PipelineStageConfigItem,
  isCommercialTerminalStage,
  normalizeCommercialPipelineStage,
  resolveCommercialPipelineBoardStages,
} from '~/lib/commercial/pipeline-stage-config';
import { scrollWheelDeltaToScrollParent } from '~/lib/scroll-passthrough';

import type {
  PipelineData,
  PipelineDeal,
} from '../../_lib/server/pipeline.loader';
import { moveDealToStage } from '../actions';
import { AddDealDialog } from './add-deal-dialog';
import { EditDealDialog } from './edit-deal-dialog';

export type PipelineListingOption = {
  id: string;
  name: string;
  disposalType?: string | null;
  askingRentPence?: number | null;
  askingPricePence?: number | null;
  actingAgents?: Array<{
    userId: string;
    name: string;
    pictureUrl: string | null;
  }>;
};

// ─── Stage definitions ───────────────────────────────────────────────

const WORK_STAGES = [
  { key: 'lead', label: 'Lead', icon: ArrowRight },
  { key: 'qualified', label: 'Qualified', icon: ArrowRight },
  { key: 'call_booked', label: 'Call Booked', icon: Phone },
  { key: 'proposal_sent', label: 'Proposal Sent', icon: Send },
  { key: 'negotiation', label: 'Negotiation', icon: DollarSign },
  { key: 'won', label: 'Won', icon: Trophy },
  { key: 'lost', label: 'Lost', icon: X },
] as const;

function commercialStageIcon(key: string) {
  if (
    key === COMMERCIAL_PIPELINE_WON_STAGE ||
    key === 'signed' ||
    key === 'completed_exchanged'
  ) {
    return Trophy;
  }
  if (
    key === COMMERCIAL_PIPELINE_LOST_STAGE ||
    key === 'discounted' ||
    key === 'fallen_through'
  ) {
    return X;
  }
  if (key === 'current' || key === 'viewing') return Phone;
  if (
    key === 'under_offer_negotiating' ||
    key === 'under_offer' ||
    key === 'negotiating'
  ) {
    return Send;
  }
  return ArrowRight;
}

const STAGE_COLORS: Record<string, { dot: string; bar: string; tint: string }> =
  {
    lead: { dot: '#3B82F6', bar: '#3B82F6', tint: 'rgba(59,130,246,0.08)' },
    qualified: {
      dot: '#FF5C34',
      bar: '#FF5C34',
      tint: 'rgba(255, 92, 52, 0.08)',
    },
    call_booked: {
      dot: '#A855F7',
      bar: '#A855F7',
      tint: 'rgba(168,85,247,0.08)',
    },
    proposal_sent: {
      dot: '#F97316',
      bar: '#F97316',
      tint: 'rgba(249,115,22,0.08)',
    },
    negotiation: {
      dot: '#EAB308',
      bar: '#EAB308',
      tint: 'rgba(234,179,8,0.08)',
    },
    won: { dot: '#FF5C34', bar: '#FF5C34', tint: 'rgba(255, 92, 52, 0.16)' },
    lost: { dot: '#64748B', bar: '#64748B', tint: 'rgba(100,116,139,0.10)' },
    shortlisted: {
      dot: '#64748B',
      bar: '#64748B',
      tint: 'rgba(100,116,139,0.08)',
    },
    enquiry: { dot: '#3B82F6', bar: '#3B82F6', tint: 'rgba(59,130,246,0.08)' },
    viewing: {
      dot: '#A855F7',
      bar: '#A855F7',
      tint: 'rgba(168,85,247,0.08)',
    },
    negotiating: {
      dot: '#F97316',
      bar: '#F97316',
      tint: 'rgba(249,115,22,0.08)',
    },
    under_offer: {
      dot: '#EAB308',
      bar: '#EAB308',
      tint: 'rgba(234,179,8,0.08)',
    },
    signed: {
      dot: '#FF5C34',
      bar: '#FF5C34',
      tint: 'rgba(255, 92, 52, 0.16)',
    },
    idle: {
      dot: '#94A3B8',
      bar: '#94A3B8',
      tint: 'rgba(148,163,184,0.10)',
    },
    discounted: {
      dot: '#64748B',
      bar: '#64748B',
      tint: 'rgba(100,116,139,0.10)',
    },
    potential: {
      dot: '#64748B',
      bar: '#64748B',
      tint: 'rgba(100,116,139,0.08)',
    },
    current: {
      dot: '#3B82F6',
      bar: '#3B82F6',
      tint: 'rgba(59,130,246,0.08)',
    },
    under_offer_negotiating: {
      dot: '#EAB308',
      bar: '#EAB308',
      tint: 'rgba(234,179,8,0.08)',
    },
    completed_exchanged: {
      dot: '#FF5C34',
      bar: '#FF5C34',
      tint: 'rgba(255, 92, 52, 0.16)',
    },
    fallen_through: {
      dot: '#64748B',
      bar: '#64748B',
      tint: 'rgba(100,116,139,0.10)',
    },
  };

const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_1px_2px_rgba(42,23,32,0.04),0_3px_10px_rgba(42,23,32,0.05)]';

function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  }).format(value);
}

// ─── Board ───────────────────────────────────────────────────────────

type Props = {
  initialData: PipelineData;
  onDealWon?: (deal: PipelineDeal) => void;
  /** When set, revalidates `/app/[account]/pipeline` after server actions */
  workspaceAccountSlug?: string;
  workspaceAccountId?: string;
  initialClients?: ClientOption[];
  variant?: 'work' | 'commercial';
  listings?: PipelineListingOption[];
  /** Commercial stage overrides (rename/hide). */
  stageConfig?: PipelineStageConfigItem[];
  customizePhasesSlot?: ReactNode;
  boardName?: string;
  onRequestCreateDisposal?: (deal: PipelineDeal) => void;
};

export function PipelineBoard({
  initialData,
  onDealWon,
  workspaceAccountSlug,
  workspaceAccountId,
  initialClients = [],
  variant = 'work',
  listings = [],
  stageConfig,
  customizePhasesSlot,
  boardName = 'WIP',
  onRequestCreateDisposal,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createRequested = searchParams.get('create') === 'lead';
  const [deals, setDeals] = useState<PipelineDeal[]>(initialData.deals);
  const [filter, setFilter] = useState<string>('all');
  const [activeDeal, setActiveDeal] = useState<PipelineDeal | null>(null);
  const [dealToEdit, setDealToEdit] = useState<PipelineDeal | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addDealOpen, setAddDealOpen] = useState(false);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const kanbanScrollRef = useRef<HTMLDivElement>(null);
  const isCommercial = variant === 'commercial';

  const clearCreateQuery = useCallback(() => {
    if (!createRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('create');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [createRequested, router]);

  const terminalWonStage =
    variant === 'commercial' ? COMMERCIAL_PIPELINE_WON_STAGE : 'won';

  const STAGES = useMemo(() => {
    if (variant !== 'commercial') {
      return WORK_STAGES.map((stage) => ({
        key: stage.key,
        label: stage.label,
        icon: stage.icon,
      }));
    }

    return resolveCommercialPipelineBoardStages({
      stored: stageConfig,
      dealStages: deals.map((deal) => deal.stage),
    }).map((stage) => ({
      key: stage.key,
      label: stage.label,
      icon: commercialStageIcon(stage.key),
    }));
  }, [variant, stageConfig, deals]);

  const selectableStages = useMemo(() => {
    if (variant !== 'commercial') {
      return STAGES.map((stage) => ({ key: stage.key, label: stage.label }));
    }

    const visible = resolveCommercialPipelineBoardStages({
      stored: stageConfig,
    }).filter((stage) => !stage.forceVisible);

    return (visible.length > 0 ? visible : STAGES).map((stage) => ({
      key: stage.key,
      label: stage.label,
    }));
  }, [variant, stageConfig, STAGES]);

  const listingById = useMemo(() => {
    const map = new Map<string, PipelineListingOption>();
    for (const listing of listings) {
      map.set(listing.id, listing);
    }
    return map;
  }, [listings]);

  useEffect(() => {
    const kanban = kanbanScrollRef.current;
    if (!kanban) return;

    const onWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) <= Math.abs(event.deltaX)) {
        return;
      }

      scrollWheelDeltaToScrollParent(kanban, event);
    };

    kanban.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      kanban.removeEventListener('wheel', onWheel);
    };
  }, []);

  const handleEditDeal = useCallback((deal: PipelineDeal) => {
    setDealToEdit(deal);
    setEditOpen(true);
  }, []);

  const handleDealUpdated = useCallback(
    (updated: PipelineDeal) => {
      setDeals((prev) => prev.map((d) => (d.id === updated.id ? updated : d)));
      setEditOpen(false);
      setDealToEdit(null);
      if (updated.stage === terminalWonStage) {
        onDealWon?.(updated);
      }
    },
    [onDealWon, terminalWonStage],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredDeals = useMemo(
    () =>
      filter === 'all' ? deals : deals.filter((d) => d.businessId === filter),
    [deals, filter],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const stage of STAGES) {
      map.set(stage.key, []);
    }
    for (const deal of filteredDeals) {
      const stageKey =
        variant === 'commercial'
          ? normalizeCommercialPipelineStage(deal.stage)
          : deal.stage;
      const arr = map.get(stageKey);
      if (arr) arr.push(deal);
      else map.set(stageKey, [deal]);
    }
    return map;
  }, [filteredDeals, STAGES, variant]);

  const totalValue = filteredDeals.reduce((s, d) => s + d.value, 0);
  const activeCount = filteredDeals.filter((d) =>
    variant === 'commercial'
      ? !isCommercialTerminalStage(d.stage)
      : d.stage !== 'won' && d.stage !== 'lost',
  ).length;

  const exportDealsCsv = useCallback(() => {
    const rows = filteredDeals.map((deal) => {
      const listing = deal.commercialListingId
        ? listingById.get(deal.commercialListingId)
        : undefined;
      const stageLabel =
        STAGES.find((s) => s.key === deal.stage)?.label ?? deal.stage;
      return [
        deal.contactName || deal.clientName || '',
        deal.companyName || '',
        stageLabel,
        listing?.name ?? '',
        String(deal.value ?? 0),
        deal.nextAction || '',
        deal.nextActionDate || '',
      ];
    });
    const header = [
      'Contact',
      'Company',
      'Stage',
      'Disposal',
      'Value',
      'Next action',
      'Next action date',
    ];
    const escape = (value: string) => `"${value.replaceAll('"', '""')}"`;
    const csv = [header, ...rows]
      .map((row) => row.map((cell) => escape(String(cell))).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = isCommercial ? 'wip.csv' : 'deals.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [filteredDeals, listingById, STAGES, isCommercial]);

  const onDragStart = useCallback(
    (event: DragStartEvent) => {
      const deal = deals.find((d) => d.id === event.active.id);
      setActiveDeal(deal ?? null);
    },
    [deals],
  );

  const onDragEnd = useCallback(
    (event: DragEndEvent) => {
      setActiveDeal(null);
      const { active, over } = event;
      if (!over) return;

      const dealId = active.id as string;
      const overId = over.id as string;
      const overStage = (over.data.current as any)?.stage as string | undefined;

      let newStage: string | null = null;

      if (overStage) {
        newStage = overStage;
      } else if (overId.startsWith('stage-')) {
        newStage = overId.replace('stage-', '');
      } else {
        const targetDeal = deals.find((d) => d.id === overId);
        if (targetDeal) newStage = targetDeal.stage;
      }

      if (!newStage) return;

      const currentDeal = deals.find((d) => d.id === dealId);
      if (!currentDeal || currentDeal.stage === newStage) return;

      const updatedDeal = { ...currentDeal, stage: newStage! };
      setDeals((prev) => prev.map((d) => (d.id === dealId ? updatedDeal : d)));

      startTransition(async () => {
        const result = await moveDealToStage(dealId, newStage!, {
          accountSlug: workspaceAccountSlug,
        });
        if (!result.success) {
          setDeals((prev) =>
            prev.map((d) =>
              d.id === dealId ? { ...d, stage: currentDeal.stage } : d,
            ),
          );
        } else if (
          newStage === 'won' ||
          newStage === COMMERCIAL_PIPELINE_WON_STAGE ||
          newStage === 'completed' ||
          newStage === 'completed_exchanged' ||
          newStage === 'signed'
        ) {
          onDealWon?.(updatedDeal);
        }
      });
    },
    [deals, startTransition, onDealWon, workspaceAccountSlug],
  );

  return (
    <div className="flex min-h-[calc(100svh-3.5rem)] w-full flex-col gap-6 px-4 pt-6 pb-12 text-[var(--workspace-shell-text)] md:px-6 lg:px-8">
      {/* Header */}
      <div
        className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${isCommercial ? 'sm:justify-end' : ''}`}
      >
        {!isCommercial ? (
          <div>
            <h1 className="text-lg font-bold text-[var(--workspace-shell-text)]">
              Pipeline
            </h1>
            <p className="mt-0.5 text-sm text-[var(--workspace-shell-text-muted)]">
              {activeCount} active leads · {formatCurrency(totalValue)} total
              value
              {isPending && (
                <span className="ml-2 text-xs text-amber-400">Saving...</span>
              )}
            </p>
          </div>
        ) : isPending ? (
          <p className="text-xs text-amber-400 sm:mr-auto">Saving...</p>
        ) : (
          <span className="hidden sm:block sm:flex-1" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          {!isCommercial ? (
            <div className="flex rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-1 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${filter === 'all' ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'}`}
              >
                All
              </button>
              {initialData.businesses.map((biz) => (
                <button
                  key={biz.id}
                  type="button"
                  onClick={() => setFilter(biz.id)}
                  className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${filter === biz.id ? 'bg-[var(--workspace-shell-sidebar-accent)] text-[var(--workspace-shell-text)]' : 'text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text)]'}`}
                >
                  {biz.name}
                </button>
              ))}
            </div>
          ) : null}
          {!isCommercial ? customizePhasesSlot : null}
          {workspaceAccountSlug && !isCommercial ? (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] text-[var(--workspace-shell-text)]/80 hover:bg-white/[0.08] hover:text-[var(--workspace-shell-text)]"
            >
              <Link
                href={`${pathsConfig.app.accountLinkedInImport.replace(
                  '[account]',
                  workspaceAccountSlug,
                )}?destination=pipeline`}
              >
                <Linkedin className="mr-1.5 h-3.5 w-3.5" />
                LinkedIn
              </Link>
            </Button>
          ) : null}
          {isCommercial ? (
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
                <DropdownMenuItem onSelect={() => exportDealsCsv()}>
                  <Download className="mr-2 h-3.5 w-3.5" />
                  Export CSV
                </DropdownMenuItem>
                <DropdownMenuItem
                  onSelect={() =>
                    toast.message('AI summary coming soon', {
                      description:
                        'A board-wide deal summary will appear here in a follow-up.',
                    })
                  }
                >
                  <Sparkles className="mr-2 h-3.5 w-3.5" />
                  AI summary
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <AddDealDialog
            businesses={initialData.businesses}
            onDealCreated={(deal) => setDeals((prev) => [deal, ...prev])}
            accountSlug={workspaceAccountSlug}
            accountId={workspaceAccountId}
            initialClients={initialClients}
            stages={selectableStages}
            defaultStage={selectableStages[0]?.key}
            listings={listings}
            commercial={isCommercial}
            open={addDealOpen || createRequested}
            onOpenChange={(open) => {
              setAddDealOpen(open);
              if (!open) clearCreateQuery();
            }}
          />
        </div>
      </div>

      {isCommercial && workspaceAccountId && workspaceAccountSlug ? (
        <CustomizePipelinePhasesDialog
          accountId={workspaceAccountId}
          accountSlug={workspaceAccountSlug}
          initialStages={stageConfig ?? []}
          initialBoardName={boardName}
          open={customizeOpen}
          onOpenChange={setCustomizeOpen}
          showTrigger={false}
        />
      ) : null}

      <EditDealDialog
        deal={dealToEdit}
        businesses={initialData.businesses}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setDealToEdit(null);
        }}
        onDealUpdated={handleDealUpdated}
        accountSlug={workspaceAccountSlug}
        accountId={workspaceAccountId}
        initialClients={initialClients}
        stages={selectableStages}
        listings={listings}
        commercial={isCommercial}
        onRequestCreateDisposal={
          onRequestCreateDisposal
            ? (deal) => {
                setEditOpen(false);
                setDealToEdit(null);
                onRequestCreateDisposal(deal);
              }
            : undefined
        }
      />

      {/* Kanban */}
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
          {STAGES.map((stage) => {
            const stageDeals = dealsByStage.get(stage.key) ?? [];
            const stageValue = stageDeals.reduce((s, d) => s + d.value, 0);
            return (
              <StageColumn
                key={stage.key}
                stageKey={stage.key}
                label={stage.label}
                deals={stageDeals}
                value={stageValue}
                onEditDeal={handleEditDeal}
                listingById={listingById}
                commercial={isCommercial}
              />
            );
          })}
        </div>

        <DragOverlay dropAnimation={null}>
          {activeDeal && (
            <DealCard
              deal={activeDeal}
              stageColor={STAGE_COLORS[activeDeal.stage]}
              isOverlay
              onEdit={() => {}}
              listing={
                activeDeal.commercialListingId
                  ? (listingById.get(activeDeal.commercialListingId) ?? null)
                  : null
              }
              commercial={isCommercial}
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

// ─── Column (droppable) ──────────────────────────────────────────────

function StageColumn({
  stageKey,
  label,
  deals,
  value,
  onEditDeal,
  listingById,
  commercial,
}: {
  stageKey: string;
  label: string;
  deals: PipelineDeal[];
  value: number;
  onEditDeal: (deal: PipelineDeal) => void;
  listingById: Map<string, PipelineListingOption>;
  commercial: boolean;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stageKey}`,
    data: { stage: stageKey },
  });

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
            {deals.length}
          </span>
        </div>
        {value > 0 && (
          <span className="text-xs text-[var(--workspace-shell-text-muted)]">
            {formatCurrency(value)}
          </span>
        )}
      </div>

      <SortableContext
        items={deals.map((d) => d.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {deals.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-4 py-8 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              Drag {commercial ? 'instructions' : 'leads'} here
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                stageColor={STAGE_COLORS[deal.stage]}
                onEdit={() => onEditDeal(deal)}
                listing={
                  deal.commercialListingId
                    ? (listingById.get(deal.commercialListingId) ?? null)
                    : null
                }
                commercial={commercial}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

// ─── Card (draggable) ────────────────────────────────────────────────

function DealCard({
  deal,
  stageColor,
  isOverlay = false,
  onEdit,
  listing,
  commercial = false,
}: {
  deal: PipelineDeal;
  stageColor: { dot: string; bar: string; tint: string } | undefined;
  isOverlay?: boolean;
  onEdit: () => void;
  listing?: PipelineListingOption | null;
  commercial?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: deal.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
    ...(stageColor && !isOverlay ? { backgroundColor: stageColor.tint } : {}),
  };

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
  const subtitle = commercial
    ? companySubtitle
    : deal.clientId
      ? deal.projectName && deal.projectName !== clientLabel
        ? deal.projectName
        : companySubtitle
      : companySubtitle;

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
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={`${panelClass} cursor-grab p-4 active:cursor-grabbing ${isOverlay ? 'scale-105 rotate-2 shadow-[0_2px_8px_rgba(42,23,32,0.06),0_8px_24px_rgba(42,23,32,0.08)]' : ''}`}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      {stageColor && !isOverlay && (
        <div
          className="mb-2 h-1 w-full rounded-full"
          style={{ backgroundColor: stageColor.bar }}
        />
      )}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex min-w-0 items-start gap-2">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
              {title}
            </p>
            {subtitle ? (
              <p className="text-xs text-[var(--workspace-shell-text-muted)]">
                {subtitle}
              </p>
            ) : null}
            {listingName ? (
              <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
                {listingName}
              </p>
            ) : null}
            {commercial && (disposalType || asking) ? (
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
            {deal.clientId && !commercial ? (
              <span className="mt-1 inline-flex items-center rounded-full bg-[color:var(--ozer-accent)]/15 px-2 py-0.5 text-[10px] font-medium text-[color:var(--ozer-accent)]">
                Existing client
              </span>
            ) : null}
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="shrink-0 text-[var(--workspace-shell-text-muted)] hover:text-[var(--workspace-shell-text-muted)]"
          aria-label="Edit lead"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold text-[color:var(--ozer-accent)]">
          {formatCurrency(deal.value)}
        </span>
        <div className="flex items-center gap-2">
          {commercial && (listing?.actingAgents?.length ?? 0) > 0 ? (
            <DealAgentStack agents={listing?.actingAgents ?? []} />
          ) : null}
          {!commercial ? (
            <span className="flex items-center gap-1.5 text-xs text-[var(--workspace-shell-text-muted)]">
              {deal.businessColor && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: deal.businessColor }}
                />
              )}
              {stageColor && (
                <span
                  className="inline-block h-2 w-2 rounded-full"
                  style={{ backgroundColor: stageColor.dot }}
                />
              )}
              {deal.businessName}
            </span>
          ) : stageColor ? (
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ backgroundColor: stageColor.dot }}
            />
          ) : null}
        </div>
      </div>
      {deal.nextAction && (
        <div className="mt-2 border-t border-[color:var(--workspace-shell-border)] pt-2">
          <p className="text-xs text-[var(--workspace-shell-text-muted)]">
            {deal.nextAction}
            {deal.nextActionDate ? ` · ${deal.nextActionDate}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function DealAgentStack({
  agents,
}: {
  agents: Array<{ userId: string; name: string; pictureUrl: string | null }>;
}) {
  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex items-center -space-x-1.5">
        {agents.slice(0, 3).map((agent) => (
          <Tooltip key={agent.userId}>
            <TooltipTrigger asChild>
              <span className="relative inline-flex h-6 w-6 overflow-hidden rounded-full ring-2 ring-[var(--workspace-shell-panel)]">
                {agent.pictureUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={agent.pictureUrl}
                    alt=""
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center bg-[var(--workspace-shell-sidebar-accent)] text-[9px] font-semibold text-[var(--workspace-shell-text)]/70">
                    {agent.name
                      .split(/\s+/)
                      .map((p) => p[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()}
                  </span>
                )}
              </span>
            </TooltipTrigger>
            <TooltipContent side="top">{agent.name}</TooltipContent>
          </Tooltip>
        ))}
      </div>
    </TooltipProvider>
  );
}
