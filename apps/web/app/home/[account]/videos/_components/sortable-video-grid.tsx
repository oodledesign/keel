'use client';

import type { ReactNode } from 'react';

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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical } from 'lucide-react';

import type { VideoRow } from '~/lib/videos/types';

function SortableItem(props: { video: VideoRow; children: ReactNode }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: props.video.id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={`relative ${isDragging ? 'z-10 opacity-80 shadow-lg' : ''}`}
    >
      {props.children}
      {/* Handle only: the rest of the card keeps its links and menu. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={`Drag to reorder ${props.video.title}`}
        className="absolute top-2 left-2 z-10 flex size-7 cursor-grab touch-none items-center justify-center rounded-md bg-black/70 text-white active:cursor-grabbing"
      >
        <GripVertical className="size-4" aria-hidden />
      </button>
    </div>
  );
}

/** Grid whose cards can be dragged into a new order. */
export function SortableVideoGrid(props: {
  videos: VideoRow[];
  onReorder: (orderedIds: string[]) => void;
  renderCard: (video: VideoRow) => ReactNode;
}) {
  const sensors = useSensors(
    // A small drag distance keeps plain clicks on the handle harmless.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const ids = props.videos.map((video) => video.id);

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;
    const from = ids.indexOf(String(active.id));
    const to = ids.indexOf(String(over.id));
    if (from < 0 || to < 0) return;
    props.onReorder(arrayMove(ids, from, to));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext items={ids} strategy={rectSortingStrategy}>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {props.videos.map((video) => (
            <SortableItem key={video.id} video={video}>
              {props.renderCard(video)}
            </SortableItem>
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
