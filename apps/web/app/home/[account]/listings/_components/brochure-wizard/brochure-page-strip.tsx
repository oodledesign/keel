'use client';

import {
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Copy, GripVertical, Plus, Trash2 } from 'lucide-react';

import { Button } from '@kit/ui/button';
import { cn } from '@kit/ui/utils';

import type { BrochurePage } from '~/lib/commercial/brochure-pdf/brochure-document';

import { brochureLayoutLabel } from './brochure-preview-page';

function SortablePageRow({
  page,
  index,
  selected,
  warned,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  page: BrochurePage;
  index: number;
  selected: boolean;
  warned: boolean;
  onSelect: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: page.id });

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group flex items-center gap-1 rounded-md border p-1.5 transition-colors',
        selected
          ? 'border-[var(--ozer-accent)] bg-[var(--ozer-accent-subtle)]'
          : 'border-[var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] hover:bg-[var(--workspace-shell-sidebar-accent)]',
        isDragging && 'z-10 shadow-md',
      )}
    >
      <button
        type="button"
        className="cursor-grab touch-none p-0.5 text-[var(--workspace-shell-text-muted)]"
        aria-label={`Reorder page ${index + 1}`}
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        onClick={onSelect}
        className="min-w-0 flex-1 text-left"
      >
        <span className="block text-[10px] text-[var(--workspace-shell-text-muted)]">
          Page {index + 1}
          {warned ? (
            <span className="ml-1 text-[var(--ozer-accent)]">· check</span>
          ) : null}
        </span>
        <span className="block truncate text-xs font-medium text-[var(--workspace-shell-text)]">
          {brochureLayoutLabel(page.layoutId)}
        </span>
      </button>
      <div className="flex opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label={`Duplicate page ${index + 1}`}
          onClick={onDuplicate}
        >
          <Copy className="h-3 w-3" />
        </Button>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-6 w-6"
          aria-label={`Delete page ${index + 1}`}
          onClick={onDelete}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </li>
  );
}

/** Page list: drag to reorder, duplicate, delete, add. */
export function BrochurePageStrip({
  pages,
  selectedPageId,
  warnedPageIds,
  onSelect,
  onReorder,
  onDuplicate,
  onDelete,
  onAdd,
}: {
  pages: BrochurePage[];
  selectedPageId: string | null;
  warnedPageIds: ReadonlySet<string>;
  onSelect: (pageId: string) => void;
  onReorder: (pages: BrochurePage[]) => void;
  onDuplicate: (pageId: string) => void;
  onDelete: (pageId: string) => void;
  onAdd: () => void;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = pages.findIndex((p) => p.id === active.id);
    const to = pages.findIndex((p) => p.id === over.id);
    if (from < 0 || to < 0) return;
    onReorder(arrayMove(pages, from, to));
  }

  return (
    <div className="flex min-h-0 flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-[var(--workspace-shell-text)]">
          Pages ({pages.length})
        </p>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs"
          disabled={pages.length >= 30}
          onClick={onAdd}
        >
          <Plus className="h-3.5 w-3.5" />
          Add
        </Button>
      </div>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext
          items={pages.map((p) => p.id)}
          strategy={verticalListSortingStrategy}
        >
          <ol className="min-h-0 space-y-1.5 overflow-y-auto pr-1">
            {pages.map((page, index) => (
              <SortablePageRow
                key={page.id}
                page={page}
                index={index}
                selected={page.id === selectedPageId}
                warned={warnedPageIds.has(page.id)}
                onSelect={() => onSelect(page.id)}
                onDuplicate={() => onDuplicate(page.id)}
                onDelete={() => onDelete(page.id)}
              />
            ))}
          </ol>
        </SortableContext>
      </DndContext>
    </div>
  );
}
