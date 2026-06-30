'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { CalendarClock, Coffee, GripVertical, Loader2 } from 'lucide-react';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@kit/ui/select';
import { toast } from '@kit/ui/sonner';
import { cn } from '@kit/ui/utils';

import {
  flattenPlanBlocks,
  setPlanBlockDuration,
  updatePlanBlock,
  type EditablePlanBlock,
  type PlanDocument,
} from '~/lib/planner/plan-blocks';
import {
  findValidDropStart,
  findValidDuration,
  getDayBounds,
  MIN_BLOCK_MINUTES,
  minutesFromPointerY,
  snapToQuarterHour,
  canPlaceBlock,
} from '~/lib/planner/schedule-constraints';

const PX_PER_MINUTE = 1.25;
const DURATION_OPTIONS = [15, 30, 45, 60, 75, 90, 105, 120];

type DragState = {
  blockId: string;
  kind: 'move' | 'resize';
  pointerStartY: number;
  originStart: number;
  originEnd: number;
};

type Props = {
  document: PlanDocument;
  onDocumentChange: (document: PlanDocument) => void;
  onPersist: (document: PlanDocument) => Promise<void>;
  now: Date;
};

function formatClock(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });
}

function blockStatus(
  block: EditablePlanBlock,
  now: Date,
): 'past' | 'current' | 'upcoming' {
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes >= block.endMinutes) return 'past';
  if (nowMinutes >= block.startMinutes) return 'current';
  return 'upcoming';
}

export function DayScheduleEditor({
  document,
  onDocumentChange,
  onPersist,
  now,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{
    blockId: string;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const blocks = useMemo(() => flattenPlanBlocks(document), [document]);
  const { dayStart, dayEnd } = useMemo(() => getDayBounds(blocks), [blocks]);
  const gridHeight = (dayEnd - dayStart) * PX_PER_MINUTE;

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = dayStart; minute <= dayEnd; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, [dayStart, dayEnd]);

  const applyBlockTimes = useCallback(
    async (blockId: string, startMinutes: number, endMinutes: number) => {
      const nextDocument = updatePlanBlock(document, blockId, {
        startMinutes,
        endMinutes,
      });
      onDocumentChange(nextDocument);
      setIsSaving(true);
      try {
        await onPersist(nextDocument);
      } finally {
        setIsSaving(false);
      }
    },
    [document, onDocumentChange, onPersist],
  );

  const applyDuration = useCallback(
    async (blockId: string, durationMinutes: number) => {
      const validDuration = findValidDuration(blocks, blockId, durationMinutes);
      if (validDuration === null) {
        toast.error('That duration does not fit in the available gap');
        return;
      }

      const nextDocument = setPlanBlockDuration(document, blockId, validDuration);
      onDocumentChange(nextDocument);
      setIsSaving(true);
      try {
        await onPersist(nextDocument);
      } finally {
        setIsSaving(false);
      }
    },
    [blocks, document, onDocumentChange, onPersist],
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }

    function onPointerMove(event: PointerEvent) {
      const grid = gridRef.current;
      if (!grid) return;

      const rect = grid.getBoundingClientRect();
      const pointerMinutes = minutesFromPointerY(
        event.clientY,
        rect.top,
        PX_PER_MINUTE,
        dayStart,
      );

      if (dragState.kind === 'move') {
        const duration = dragState.originEnd - dragState.originStart;
        const delta = pointerMinutes - minutesFromPointerY(
          dragState.pointerStartY,
          rect.top,
          PX_PER_MINUTE,
          dayStart,
        );
        const proposedStart = snapToQuarterHour(dragState.originStart + delta);
        const validStart = findValidDropStart(
          blocks,
          dragState.blockId,
          proposedStart,
        );
        setPreview({
          blockId: dragState.blockId,
          startMinutes: validStart,
          endMinutes: validStart + duration,
        });
        return;
      }

      const proposedEnd = snapToQuarterHour(
        Math.max(dragState.originStart + MIN_BLOCK_MINUTES, pointerMinutes),
      );
      const validation = canPlaceBlock(
        blocks,
        dragState.blockId,
        dragState.originStart,
        proposedEnd,
      );
      const validEnd = validation.ok
        ? proposedEnd
        : dragState.originEnd;
      setPreview({
        blockId: dragState.blockId,
        startMinutes: dragState.originStart,
        endMinutes: validEnd,
      });
    }

    function onPointerUp() {
      if (!dragState || !preview || preview.blockId !== dragState.blockId) {
        setDragState(null);
        setPreview(null);
        return;
      }

      const block = blocks.find((item) => item.id === dragState.blockId);
      if (!block) {
        setDragState(null);
        setPreview(null);
        return;
      }

      const unchanged =
        preview.startMinutes === block.startMinutes &&
        preview.endMinutes === block.endMinutes;

      if (!unchanged) {
        const validation = canPlaceBlock(
          blocks,
          dragState.blockId,
          preview.startMinutes,
          preview.endMinutes,
        );

        if (validation.ok) {
          void applyBlockTimes(
            dragState.blockId,
            preview.startMinutes,
            preview.endMinutes,
          );
        } else if (validation.reason) {
          toast.error(validation.reason);
        }
      }

      setDragState(null);
      setPreview(null);
    }

    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);

    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [applyBlockTimes, blocks, dayStart, dragState, preview]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-xs text-[var(--workspace-shell-text)]/45">
        <p>Drag task blocks to reschedule. Calendar events stay fixed.</p>
        {isSaving ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--ozer-accent-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </span>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        <div className="flex min-w-[320px]">
          <div
            className="relative w-14 shrink-0 border-r border-[color:var(--workspace-shell-border)] bg-black/10"
            style={{ height: gridHeight }}
          >
            {hourMarks.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-[10px] tabular-nums text-[var(--workspace-shell-text)]/35"
                style={{ top: (minute - dayStart) * PX_PER_MINUTE }}
              >
                {formatClock(minute)}
              </div>
            ))}
          </div>

          <div
            ref={gridRef}
            className="relative min-w-0 flex-1"
            style={{ height: gridHeight }}
          >
            {hourMarks.map((minute) => (
              <div
                key={`line-${minute}`}
                className="pointer-events-none absolute inset-x-0 border-t border-[color:var(--workspace-shell-border)]"
                style={{ top: (minute - dayStart) * PX_PER_MINUTE }}
              />
            ))}

            {blocks.map((block) => {
              const previewing = preview?.blockId === block.id ? preview : null;
              const startMinutes = previewing?.startMinutes ?? block.startMinutes;
              const endMinutes = previewing?.endMinutes ?? block.endMinutes;
              const top = (startMinutes - dayStart) * PX_PER_MINUTE;
              const height = Math.max(
                (endMinutes - startMinutes) * PX_PER_MINUTE,
                MIN_BLOCK_MINUTES * PX_PER_MINUTE,
              );
              const status = blockStatus(
                { ...block, startMinutes, endMinutes },
                now,
              );
              const Icon = block.isBreak ? Coffee : CalendarClock;
              const duration = endMinutes - startMinutes;
              const durationOptions = DURATION_OPTIONS.includes(duration)
                ? DURATION_OPTIONS
                : [...DURATION_OPTIONS, duration].sort((a, b) => a - b);

              return (
                <div
                  key={block.id}
                  className={cn(
                    'absolute inset-x-2 overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm',
                    block.isCalendarEvent
                      ? 'border-[color:var(--workspace-shell-border)] bg-sky-400/15'
                      : block.isBreak
                        ? 'border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]'
                        : 'border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]',
                    status === 'current' &&
                      'ring-1 ring-[#FF5C34]/40',
                    status === 'past' && 'opacity-50',
                    dragState?.blockId === block.id && 'z-20 opacity-90',
                    !block.movable && 'cursor-default',
                  )}
                  style={{ top, height }}
                >
                  <div className="flex h-full min-h-0 flex-col gap-1">
                    <div className="flex min-w-0 items-start gap-1.5">
                      {block.movable ? (
                        <button
                          type="button"
                          className="mt-0.5 shrink-0 cursor-grab text-[var(--workspace-shell-text)]/35 hover:text-[var(--workspace-shell-text)]/70 active:cursor-grabbing"
                          aria-label={`Move ${block.title}`}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.currentTarget.setPointerCapture(event.pointerId);
                            setDragState({
                              blockId: block.id,
                              kind: 'move',
                              pointerStartY: event.clientY,
                              originStart: block.startMinutes,
                              originEnd: block.endMinutes,
                            });
                            setPreview({
                              blockId: block.id,
                              startMinutes: block.startMinutes,
                              endMinutes: block.endMinutes,
                            });
                          }}
                        >
                          <GripVertical className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <Icon
                          className={cn(
                            'mt-0.5 h-3.5 w-3.5 shrink-0',
                            block.isCalendarEvent
                              ? 'text-sky-300/80'
                              : 'text-[var(--workspace-shell-text)]/30',
                          )}
                        />
                      )}

                      <div className="min-w-0 flex-1">
                        <p
                          className={cn(
                            'truncate text-xs font-medium',
                            block.isBreak
                              ? 'italic text-[var(--workspace-shell-text)]/45'
                              : 'text-[var(--workspace-shell-text)]',
                          )}
                        >
                          {block.title}
                        </p>
                        <p className="text-[10px] tabular-nums text-[var(--workspace-shell-text)]/40">
                          {formatClock(startMinutes)} – {formatClock(endMinutes)}
                        </p>
                      </div>

                      {block.movable ? (
                        <Select
                          value={String(duration)}
                          onValueChange={(value) => {
                            void applyDuration(block.id, Number(value));
                          }}
                        >
                          <SelectTrigger className="h-6 w-[4.5rem] border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)] px-2 text-[10px] text-[var(--workspace-shell-text)]/70">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {durationOptions.map((option) => (
                              <SelectItem key={option} value={String(option)}>
                                {option} min
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : null}
                    </div>

                    {block.movable ? (
                      <button
                        type="button"
                        aria-label={`Resize ${block.title}`}
                        className="mt-auto h-1.5 w-full shrink-0 cursor-ns-resize rounded-full bg-[var(--workspace-shell-sidebar-accent)] hover:bg-[var(--ozer-accent)]/40"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          event.currentTarget.setPointerCapture(event.pointerId);
                          setDragState({
                            blockId: block.id,
                            kind: 'resize',
                            pointerStartY: event.clientY,
                            originStart: block.startMinutes,
                            originEnd: block.endMinutes,
                          });
                          setPreview({
                            blockId: block.id,
                            startMinutes: block.startMinutes,
                            endMinutes: block.endMinutes,
                          });
                        }}
                      />
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
