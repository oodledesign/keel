'use client';

import { useCallback, useMemo, useState, useTransition } from 'react';

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
import { Pencil, Plus, Search } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { Card, CardContent } from '@kit/ui/card';

import {
  REQUIREMENT_STATUSES,
  REQUIREMENT_STATUS_LABELS,
  type RequirementStatus,
} from '~/lib/commercial/commercial-constants';
import { workspaceBtnPrimaryMd, workspacePanelCard } from '~/lib/workspace-ui';

import type { CommercialRequirement } from '../_lib/server/requirements.service';
import { updateRequirement } from '../_lib/server/server-actions';
import { RequirementFormModal } from './requirement-form-modal';

const BOARD_STAGES: RequirementStatus[] = [...REQUIREMENT_STATUSES];

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

interface RequirementsBoardProps {
  accountId: string;
  initialRequirements: CommercialRequirement[];
}

export function RequirementsBoard({
  accountId,
  initialRequirements,
}: RequirementsBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const createRequested = searchParams.get('create') === '1';
  const [items, setItems] = useState(initialRequirements);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CommercialRequirement | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const clearCreateQuery = useCallback(() => {
    if (!createRequested) return;
    const url = new URL(window.location.href);
    url.searchParams.delete('create');
    router.replace(url.pathname + url.search, { scroll: false });
  }, [createRequested, router]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const handleSaved = useCallback(() => router.refresh(), [router]);

  const byStage = useMemo(() => {
    const map = new Map<RequirementStatus, CommercialRequirement[]>();
    for (const stage of BOARD_STAGES) map.set(stage, []);
    for (const item of items) {
      const stage = BOARD_STAGES.includes(item.stage)
        ? item.stage
        : 'new';
      map.get(stage)!.push(item);
    }
    return map;
  }, [items]);

  const activeItem = activeId
    ? (items.find((item) => item.id === activeId) ?? null)
    : null;

  const onDragStart = (event: DragStartEvent) => {
    setActiveId(String(event.active.id));
  };

  const onDragEnd = (event: DragEndEvent) => {
    setActiveId(null);
    const requirementId = String(event.active.id);
    const overId = event.over?.id ? String(event.over.id) : null;
    if (!overId) return;

    let nextStage: RequirementStatus | null = null;
    if (overId.startsWith('stage-')) {
      nextStage = overId.slice('stage-'.length) as RequirementStatus;
    } else {
      const overItem = items.find((item) => item.id === overId);
      nextStage = overItem?.stage ?? null;
    }

    if (!nextStage || !BOARD_STAGES.includes(nextStage)) return;

    const current = items.find((item) => item.id === requirementId);
    if (!current || current.stage === nextStage) return;

    setItems((prev) =>
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
        handleSaved();
      } catch {
        setItems((prev) =>
          prev.map((item) =>
            item.id === requirementId
              ? { ...item, stage: current.stage }
              : item,
          ),
        );
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--workspace-shell-text)]">
            Requirements board
          </h2>
          <p className="text-sm text-[var(--workspace-shell-text)]/50">
            {items.length} applicant {items.length === 1 ? 'brief' : 'briefs'} ·
            drag cards between stages
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setModalOpen(true);
          }}
          className={workspaceBtnPrimaryMd}
        >
          <Plus className="h-4 w-4" />
          Add requirement
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className={workspacePanelCard}>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Search className="mb-4 h-12 w-12 text-[var(--workspace-shell-text)]/20" />
            <p className="font-medium text-[var(--workspace-shell-text)]">
              No requirements yet
            </p>
            <p className="mt-1 text-sm text-[var(--workspace-shell-text)]/50">
              Capture applicant briefs to match against stock.
            </p>
          </CardContent>
        </Card>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        >
          <div className="flex min-h-[420px] gap-3 overflow-x-auto pb-2">
            {BOARD_STAGES.map((stage) => {
              const stageItems = byStage.get(stage) ?? [];
              return (
                <StageColumn
                  key={stage}
                  stage={stage}
                  items={stageItems}
                  onEdit={(req) => {
                    setEditing(req);
                    setModalOpen(true);
                  }}
                />
              );
            })}
          </div>
          <DragOverlay dropAnimation={null}>
            {activeItem ? (
              <RequirementCard
                requirement={activeItem}
                onEdit={() => {}}
                overlay
              />
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <RequirementFormModal
        open={modalOpen || createRequested}
        onClose={() => {
          setModalOpen(false);
          setEditing(null);
          clearCreateQuery();
        }}
        accountId={accountId}
        requirement={editing}
        onSaved={() => {
          setModalOpen(false);
          setEditing(null);
          clearCreateQuery();
          handleSaved();
        }}
      />
    </div>
  );
}

function StageColumn({
  stage,
  items,
  onEdit,
}: {
  stage: RequirementStatus;
  items: CommercialRequirement[];
  onEdit: (req: CommercialRequirement) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `stage-${stage}`,
    data: { stage },
  });

  return (
    <div
      ref={setNodeRef}
      className={`flex w-[240px] shrink-0 flex-col rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 transition-colors ${
        isOver ? 'bg-[var(--workspace-shell-sidebar-accent)]' : ''
      }`}
    >
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-[var(--workspace-shell-text)]">
          {REQUIREMENT_STATUS_LABELS[stage]}
        </p>
        <span className="rounded-full bg-[var(--workspace-shell-sidebar-accent)] px-2 py-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
          {items.length}
        </span>
      </div>
      <SortableContext
        items={items.map((item) => item.id)}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2">
          {items.length === 0 ? (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[color:var(--workspace-shell-border)] px-3 py-8 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              Drop here
            </div>
          ) : (
            items.map((item) => (
              <RequirementCard
                key={item.id}
                requirement={item}
                onEdit={() => onEdit(item)}
              />
            ))
          )}
        </div>
      </SortableContext>
    </div>
  );
}

function RequirementCard({
  requirement,
  onEdit,
  overlay = false,
}: {
  requirement: CommercialRequirement;
  onEdit: () => void;
  overlay?: boolean;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: requirement.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  const size = sizeLabel(requirement);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : style}
      className={`rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-canvas)] p-3 shadow-[0_1px_2px_rgba(42,23,32,0.04)] ${
        overlay ? 'scale-105 shadow-lg' : 'cursor-grab active:cursor-grabbing'
      }`}
      {...(overlay ? {} : { ...attributes, ...listeners })}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-[var(--workspace-shell-text)]">
            {applicantLabel(requirement)}
          </p>
          {requirement.locationText ? (
            <p className="mt-0.5 truncate text-xs text-[var(--workspace-shell-text-muted)]">
              {requirement.locationText}
            </p>
          ) : null}
          {size ? (
            <p className="mt-0.5 text-xs text-[var(--workspace-shell-text-muted)]">
              {size}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          className="rounded-md p-1 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
          onClick={(e) => {
            e.stopPropagation();
            onEdit();
          }}
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
