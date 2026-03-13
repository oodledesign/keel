'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  closestCorners,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

import {
  ArrowRight,
  DollarSign,
  MoreHorizontal,
  Phone,
  Send,
  Trophy,
  X,
} from 'lucide-react';

import type { PipelineData, PipelineDeal } from '../../_lib/server/pipeline.loader';
import { moveDealToStage } from '../actions';
import { AddDealDialog } from './add-deal-dialog';
import { EditDealDialog } from './edit-deal-dialog';

// ─── Stage definitions ───────────────────────────────────────────────

const STAGES = [
  { key: 'lead', label: 'Lead', icon: ArrowRight },
  { key: 'qualified', label: 'Qualified', icon: ArrowRight },
  { key: 'call_booked', label: 'Call Booked', icon: Phone },
  { key: 'proposal_sent', label: 'Proposal Sent', icon: Send },
  { key: 'negotiation', label: 'Negotiation', icon: DollarSign },
  { key: 'won', label: 'Won', icon: Trophy },
  { key: 'lost', label: 'Lost', icon: X },
] as const;

const STAGE_COLORS: Record<
  string,
  { dot: string; bar: string; tint: string }
> = {
  lead: { dot: '#3B82F6', bar: '#3B82F6', tint: 'rgba(59,130,246,0.08)' },
  qualified: { dot: '#22C55E', bar: '#22C55E', tint: 'rgba(34,197,94,0.08)' },
  call_booked: { dot: '#A855F7', bar: '#A855F7', tint: 'rgba(168,85,247,0.08)' },
  proposal_sent: { dot: '#F97316', bar: '#F97316', tint: 'rgba(249,115,22,0.08)' },
  negotiation: { dot: '#EAB308', bar: '#EAB308', tint: 'rgba(234,179,8,0.08)' },
  won: { dot: '#22C55E', bar: '#22C55E', tint: 'rgba(34,197,94,0.16)' },
  lost: { dot: '#64748B', bar: '#64748B', tint: 'rgba(100,116,139,0.10)' },
};

const panelClass =
  'rounded-2xl border border-white/6 bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

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
};

export function PipelineBoard({ initialData, onDealWon }: Props) {
  const [deals, setDeals] = useState<PipelineDeal[]>(initialData.deals);
  const [filter, setFilter] = useState<string>('all');
  const [activeDeal, setActiveDeal] = useState<PipelineDeal | null>(null);
  const [dealToEdit, setDealToEdit] = useState<PipelineDeal | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleEditDeal = useCallback((deal: PipelineDeal) => {
    setDealToEdit(deal);
    setEditOpen(true);
  }, []);

  const handleDealUpdated = useCallback(
    (updated: PipelineDeal) => {
      setDeals((prev) =>
        prev.map((d) => (d.id === updated.id ? updated : d)),
      );
      setEditOpen(false);
      setDealToEdit(null);
      if (updated.stage === 'won') {
        onDealWon?.(updated);
      }
    },
    [onDealWon],
  );

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const filteredDeals = useMemo(
    () =>
      filter === 'all'
        ? deals
        : deals.filter((d) => d.businessId === filter),
    [deals, filter],
  );

  const dealsByStage = useMemo(() => {
    const map = new Map<string, PipelineDeal[]>();
    for (const stage of STAGES) {
      map.set(stage.key, []);
    }
    for (const deal of filteredDeals) {
      const arr = map.get(deal.stage);
      if (arr) arr.push(deal);
      else map.set(deal.stage, [deal]);
    }
    return map;
  }, [filteredDeals]);

  const totalValue = filteredDeals.reduce((s, d) => s + d.value, 0);
  const activeCount = filteredDeals.filter(
    (d) => d.stage !== 'won' && d.stage !== 'lost',
  ).length;

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
      setDeals((prev) =>
        prev.map((d) => (d.id === dealId ? updatedDeal : d)),
      );

      startTransition(async () => {
        const result = await moveDealToStage(dealId, newStage!);
        if (!result.success) {
          setDeals((prev) =>
            prev.map((d) =>
              d.id === dealId ? { ...d, stage: currentDeal.stage } : d,
            ),
          );
        } else if (newStage === 'won') {
          onDealWon?.(updatedDeal);
        }
      });
    },
    [deals, startTransition, onDealWon],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6 px-4 pb-12 pt-6 text-white md:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight md:text-3xl">
            Pipeline
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            {activeCount} active deals · {formatCurrency(totalValue)} total
            value
            {isPending && (
              <span className="ml-2 text-xs text-amber-400">Saving...</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex rounded-xl border border-white/8 bg-[var(--workspace-shell-panel)] p-1 text-xs">
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${filter === 'all' ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
            >
              All
            </button>
            {initialData.businesses.map((biz) => (
              <button
                key={biz.id}
                type="button"
                onClick={() => setFilter(biz.id)}
                className={`rounded-lg px-3 py-1.5 font-medium transition-colors ${filter === biz.id ? 'bg-white/10 text-white' : 'text-zinc-400 hover:text-white'}`}
              >
                {biz.name}
              </button>
            ))}
          </div>
          <AddDealDialog
            businesses={initialData.businesses}
            onDealCreated={(deal) => setDeals((prev) => [deal, ...prev])}
          />
        </div>
      </div>

      <EditDealDialog
        deal={dealToEdit}
        businesses={initialData.businesses}
        open={editOpen}
        onOpenChange={(open) => {
          setEditOpen(open);
          if (!open) setDealToEdit(null);
        }}
        onDealUpdated={handleDealUpdated}
      />

      {/* Kanban */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        <div className="flex gap-4 overflow-x-auto pb-4">
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
}: {
  stageKey: string;
  label: string;
  deals: PipelineDeal[];
  value: number;
  onEditDeal: (deal: PipelineDeal) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stageKey}`,
    data: { stage: stageKey },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex min-w-[260px] flex-1 flex-col transition-colors ${
        isOver ? 'rounded-2xl bg-white/[0.02]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-zinc-200">{label}</span>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-xs text-zinc-400">
            {deals.length}
          </span>
        </div>
        {value > 0 && (
          <span className="text-xs text-zinc-500">
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
            <div className="rounded-xl border border-dashed border-white/8 px-4 py-8 text-center text-xs text-zinc-600">
              Drag deals here
            </div>
          ) : (
            deals.map((deal) => (
              <DealCard
                key={deal.id}
                deal={deal}
                stageColor={STAGE_COLORS[deal.stage]}
                onEdit={() => onEditDeal(deal)}
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
}: {
  deal: PipelineDeal;
  stageColor: { dot: string; bar: string; tint: string } | undefined;
  isOverlay?: boolean;
  onEdit: () => void;
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

  return (
    <div
      ref={isOverlay ? undefined : setNodeRef}
      style={isOverlay ? undefined : style}
      className={`${panelClass} p-4 cursor-grab active:cursor-grabbing ${isOverlay ? 'rotate-2 scale-105 shadow-2xl' : ''}`}
      {...(isOverlay ? {} : { ...attributes, ...listeners })}
    >
      {stageColor && !isOverlay && (
        <div
          className="mb-2 h-1 w-full rounded-full"
          style={{ backgroundColor: stageColor.bar }}
        />
      )}
      <div className="mb-2 flex items-start justify-between">
        <div className="flex items-start gap-2">
          <div>
            <p className="text-sm font-medium text-white">
              {deal.contactName}
            </p>
            <p className="text-xs text-zinc-400">{deal.companyName}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
          className="text-zinc-500 hover:text-zinc-300"
          aria-label="Edit deal"
        >
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold text-emerald-400">
          {formatCurrency(deal.value)}
        </span>
        <span className="flex items-center gap-1.5 text-xs text-zinc-400">
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
      </div>
      {deal.nextAction && (
        <div className="mt-2 border-t border-white/6 pt-2">
          <p className="text-xs text-zinc-500">
            {deal.nextAction}
            {deal.nextActionDate ? ` · ${deal.nextActionDate}` : ''}
          </p>
        </div>
      )}
    </div>
  );
}
