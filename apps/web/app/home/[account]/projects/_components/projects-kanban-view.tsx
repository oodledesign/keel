'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';

import Link from 'next/link';

import {
  DndContext,
  type DragEndEvent,
  type DragOverEvent,
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
import { GripVertical, LayoutGrid } from 'lucide-react';

import { ProfileAvatar } from '@kit/ui/profile-avatar';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import { projectDetailHref } from '~/lib/projects/project-paths';
import { deliveryProjectTitle } from '~/lib/projects/project-types';

import { getErrorMessage } from '../_lib/error-message';
import { updateJob } from '../_lib/server/server-actions';

const STATUS_COLUMNS = [
  { key: 'pending', label: 'Planned' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'on_hold', label: 'On hold' },
  { key: 'completed', label: 'Complete' },
] as const;

type BoardStatus = (typeof STATUS_COLUMNS)[number]['key'];

export type ProjectsKanbanItem = {
  id: string;
  projectType: 'delivery' | 'campaign';
  status: string;
  title: string;
  clientName?: string | null;
  clientPictureUrl?: string | null;
  dueDate?: string | null;
  /** When set, card links here instead of the host project detail route. */
  href?: string;
  sharedBadge?: string | null;
  readOnly?: boolean;
};

function isBoardStatus(value: string): value is BoardStatus {
  return STATUS_COLUMNS.some((column) => column.key === value);
}

function columnForItem(item: ProjectsKanbanItem): BoardStatus {
  if (item.projectType === 'campaign') {
    return 'in_progress';
  }
  if (item.status === 'cancelled' || item.status === 'completed') {
    return 'completed';
  }
  if (isBoardStatus(item.status)) {
    return item.status;
  }
  return 'pending';
}

function columnDroppableId(status: BoardStatus) {
  return `column:${status}`;
}

function parseColumnId(id: string | number | undefined): BoardStatus | null {
  if (typeof id !== 'string' || !id.startsWith('column:')) return null;
  const key = id.slice('column:'.length);
  return isBoardStatus(key) ? key : null;
}

function parseItemId(id: string | number | undefined): string | null {
  if (typeof id !== 'string' || !id.startsWith('item:')) return null;
  return id.slice('item:'.length);
}

export function ProjectsKanbanView({
  accountSlug,
  accountId,
  items,
  canEditJobs = false,
  personalScope = false,
  projectDetailPathBuilder,
  onStatusUpdated,
}: {
  accountSlug: string;
  accountId: string;
  items: ProjectsKanbanItem[];
  canEditJobs?: boolean;
  personalScope?: boolean;
  projectDetailPathBuilder?: (id: string) => string;
  onStatusUpdated?: () => void;
}) {
  const [localItems, setLocalItems] = useState(items);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [overColumn, setOverColumn] = useState<BoardStatus | null>(null);
  const [, startTransition] = useTransition();

  useEffect(() => {
    setLocalItems(items);
  }, [items]);

  const detailPath = (id: string) =>
    projectDetailPathBuilder?.(id) ??
    projectDetailHref(accountSlug, id, personalScope);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
  );

  const itemsByColumn = useMemo(() => {
    const map: Record<BoardStatus, ProjectsKanbanItem[]> = {
      pending: [],
      in_progress: [],
      on_hold: [],
      completed: [],
    };
    for (const item of localItems) {
      map[columnForItem(item)].push(item);
    }
    return map;
  }, [localItems]);

  const activeItem = activeId
    ? (localItems.find((item) => item.id === activeId) ?? null)
    : null;

  const persistStatus = (itemId: string, status: BoardStatus) => {
    if (itemId.startsWith('shared:')) {
      return;
    }
    startTransition(async () => {
      try {
        await updateJob({ accountId, jobId: itemId, status });
        onStatusUpdated?.();
        toast.success('Status updated');
      } catch (err) {
        setLocalItems(items);
        toast.error(getErrorMessage(err));
      }
    });
  };

  const handleDragStart = (event: DragStartEvent) => {
    const itemId = parseItemId(event.active.id);
    if (itemId) {
      const item = localItems.find((row) => row.id === itemId);
      if (item?.readOnly) {
        return;
      }
    }
    setActiveId(itemId);
    if (itemId) {
      const item = localItems.find((row) => row.id === itemId);
      if (item) setOverColumn(columnForItem(item));
    }
  };

  const handleDragOver = (event: DragOverEvent) => {
    const overId = event.over?.id;
    const asColumn = parseColumnId(overId);
    if (asColumn) {
      setOverColumn(asColumn);
      return;
    }
    const overItemId = parseItemId(overId);
    if (overItemId) {
      const overItem = localItems.find((row) => row.id === overItemId);
      if (overItem) setOverColumn(columnForItem(overItem));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const itemId = parseItemId(event.active.id);
    setActiveId(null);

    if (!itemId || !canEditJobs) {
      setOverColumn(null);
      return;
    }

    const item = localItems.find((row) => row.id === itemId);
    if (!item || item.readOnly || item.projectType !== 'delivery') {
      setOverColumn(null);
      return;
    }

    const nextStatus =
      parseColumnId(event.over?.id) ??
      (() => {
        const overItemId = parseItemId(event.over?.id);
        if (!overItemId) return null;
        const overItem = localItems.find((row) => row.id === overItemId);
        return overItem ? columnForItem(overItem) : null;
      })() ??
      overColumn;

    setOverColumn(null);

    if (!nextStatus) return;

    const currentColumn = columnForItem(item);
    if (currentColumn === nextStatus) return;

    setLocalItems((prev) =>
      prev.map((row) =>
        row.id === itemId ? { ...row, status: nextStatus } : row,
      ),
    );
    persistStatus(itemId, nextStatus);
  };

  const handleDragCancel = () => {
    setActiveId(null);
    setOverColumn(null);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCorners}
      onDragStart={handleDragStart}
      onDragOver={handleDragOver}
      onDragEnd={handleDragEnd}
      onDragCancel={handleDragCancel}
    >
      <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 overflow-x-auto md:grid-cols-2 xl:grid-cols-4">
        {STATUS_COLUMNS.map((column) => (
          <KanbanColumn
            key={column.key}
            status={column.key}
            label={column.label}
            items={itemsByColumn[column.key]}
            detailPath={detailPath}
            canEditJobs={canEditJobs}
            isOver={overColumn === column.key && Boolean(activeId)}
          />
        ))}
      </div>

      <DragOverlay>
        {activeItem ? <ProjectCardBody item={activeItem} overlay /> : null}
      </DragOverlay>
    </DndContext>
  );
}

function KanbanColumn({
  status,
  label,
  items,
  detailPath,
  canEditJobs,
  isOver,
}: {
  status: BoardStatus;
  label: string;
  items: ProjectsKanbanItem[];
  detailPath: (id: string) => string;
  canEditJobs: boolean;
  isOver: boolean;
}) {
  const { setNodeRef, isOver: isDroppableOver } = useDroppable({
    id: columnDroppableId(status),
  });

  const sortableIds = items
    .filter(
      (item) =>
        item.projectType === 'delivery' && canEditJobs && !item.readOnly,
    )
    .map((item) => `item:${item.id}`);

  return (
    <section
      ref={setNodeRef}
      className={cn(
        'flex min-h-[280px] flex-col rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] transition-colors',
        (isOver || isDroppableOver) &&
          'border-[var(--ozer-accent)]/40 bg-[color:var(--ozer-accent)]/5',
      )}
    >
      <header className="border-b border-[color:var(--workspace-shell-border)] px-3 py-2.5">
        <h3 className="text-xs font-semibold tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          {label}
          <span className="ml-2 text-[var(--workspace-shell-text-muted)]">
            {items.length}
          </span>
        </h3>
      </header>
      <SortableContext
        items={sortableIds}
        strategy={verticalListSortingStrategy}
      >
        <div className="flex flex-1 flex-col gap-2 overflow-y-auto p-2">
          {items.length === 0 ? (
            <p className="px-2 py-4 text-center text-xs text-[var(--workspace-shell-text-muted)]">
              No projects
            </p>
          ) : (
            items.map((item) => {
              const href = item.href ?? detailPath(item.id);
              if (
                item.projectType === 'delivery' &&
                canEditJobs &&
                !item.readOnly
              ) {
                return (
                  <SortableProjectCard key={item.id} item={item} href={href} />
                );
              }
              return (
                <Link key={item.id} href={href} className="block">
                  <ProjectCardBody item={item} />
                </Link>
              );
            })
          )}
        </div>
      </SortableContext>
    </section>
  );
}

function SortableProjectCard({
  item,
  href,
}: {
  item: ProjectsKanbanItem;
  href: string;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `item:${item.id}` });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.35 : 1,
      }}
      className="relative"
    >
      <button
        type="button"
        className="absolute top-2.5 left-2 z-10 rounded p-0.5 text-[var(--workspace-shell-text-muted)] hover:bg-[var(--workspace-shell-sidebar-accent)] hover:text-[var(--workspace-shell-text)]"
        aria-label="Drag to change status"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <Link href={href} className="block">
        <ProjectCardBody item={item} withDragHandleSpace />
      </Link>
    </div>
  );
}

function ProjectCardBody({
  item,
  overlay = false,
  withDragHandleSpace = false,
}: {
  item: ProjectsKanbanItem;
  overlay?: boolean;
  withDragHandleSpace?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-lg border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] p-3 transition-colors',
        overlay
          ? 'shadow-lg ring-2 ring-[var(--ozer-accent)]/40'
          : 'hover:border-[var(--ozer-accent)]/30 hover:bg-[var(--workspace-shell-panel-hover)]',
        withDragHandleSpace && 'pl-8',
      )}
    >
      <div className="mb-1 flex items-center gap-2">
        {item.projectType === 'campaign' ? (
          <LayoutGrid className="h-3.5 w-3.5 text-[var(--ozer-accent-muted)]" />
        ) : null}
        <span className="text-[10px] font-medium tracking-wide text-[var(--workspace-shell-text-muted)] uppercase">
          {item.projectType === 'campaign' ? 'Campaign' : 'Delivery'}
        </span>
      </div>
      <p className="text-sm font-medium text-[var(--workspace-shell-text)]">
        {item.title}
      </p>
      {item.sharedBadge ? (
        <p className="mt-1 text-[10px] font-medium tracking-wide text-[var(--ozer-accent)] uppercase">
          {item.sharedBadge}
        </p>
      ) : null}
      {item.clientName ? (
        <div className="mt-1 flex items-center gap-1.5">
          <ProfileAvatar
            displayName={item.clientName}
            pictureUrl={item.clientPictureUrl}
            className="h-4 w-4 shrink-0"
          />
          <p className="truncate text-xs text-[var(--workspace-shell-text-muted)]">
            {item.clientName}
          </p>
        </div>
      ) : null}
      {item.dueDate ? (
        <p className="mt-2 text-[11px] text-[var(--workspace-shell-text-muted)]">
          Due {item.dueDate}
        </p>
      ) : null}
    </div>
  );
}

export function mapDeliveryRowToKanbanItem(
  row: Record<string, unknown>,
): ProjectsKanbanItem {
  const clients = row.clients as
    | { display_name?: string | null; picture_url?: string | null }
    | null
    | undefined;
  return {
    id: String(row.id),
    projectType: 'delivery',
    status: String(row.status ?? 'pending'),
    title: deliveryProjectTitle(
      row as { title?: string | null; name?: string | null },
    ),
    clientName: clients?.display_name ?? null,
    clientPictureUrl: clients?.picture_url ?? null,
    dueDate: (row.due_date as string | null) ?? null,
  };
}

export function mapCampaignRowToKanbanItem(row: {
  id: string;
  name: string;
}): ProjectsKanbanItem {
  return {
    id: row.id,
    projectType: 'campaign',
    status: 'in_progress',
    title: row.name,
  };
}
