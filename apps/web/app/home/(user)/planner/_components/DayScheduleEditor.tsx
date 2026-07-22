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
  type EditablePlanBlock,
  type PlanDocument,
  flattenPlanBlocks,
  resolveEditablePlanBlocks,
  setPlanBlockDuration,
  updatePlanBlock,
} from '~/lib/planner/plan-blocks';
import { toLocalDateYmd } from '~/lib/planner/plan-storage';
import {
  MIN_BLOCK_MINUTES,
  canPlaceBlock,
  findValidDropStart,
  findValidDuration,
  getDayBounds,
  minutesFromPointerY,
  snapToQuarterHour,
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

type PositionedBlock = EditablePlanBlock & {
  renderStartMinutes: number;
  renderEndMinutes: number;
  laneIndex: number;
  laneCount: number;
};

type Props = {
  document: PlanDocument;
  onDocumentChange: (document: PlanDocument) => void;
  onPersist: (document: PlanDocument) => Promise<void>;
  now: Date;
  /** When set, the current-time line only appears if this is today's date. */
  scheduleDateYmd?: string;
  /** When true, calendar events can be dragged on the plan page. */
  calendarEventsMovable?: boolean;
  /** After a block move/resize is saved, push the change to Google Calendar when linked. */
  onSyncBlock?: (
    document: PlanDocument,
    blockId: string,
  ) => Promise<PlanDocument | null>;
};

function formatClock(minutes: number) {
  const date = new Date();
  date.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
  return date.toLocaleTimeString('en-GB', {
    hour: 'numeric',
    minute: '2-digit',
  });
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
  calendarEventsMovable = false,
  onSyncBlock,
  scheduleDateYmd,
}: Props) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [preview, setPreview] = useState<{
    blockId: string;
    startMinutes: number;
    endMinutes: number;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isMobileLayout, setIsMobileLayout] = useState(false);

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobileLayout(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const blocks = useMemo(
    () =>
      resolveEditablePlanBlocks(document, {
        movableCalendarEvents: calendarEventsMovable,
      }),
    [calendarEventsMovable, document],
  );
  const { dayStart, dayEnd } = useMemo(() => getDayBounds(blocks), [blocks]);
  const gridHeight = (dayEnd - dayStart) * PX_PER_MINUTE;
  const positionedBlocks = useMemo<PositionedBlock[]>(() => {
    const blocksWithRenderTimes = blocks.map((block) => {
      const previewing = preview?.blockId === block.id ? preview : null;
      return {
        ...block,
        renderStartMinutes: previewing?.startMinutes ?? block.startMinutes,
        renderEndMinutes: previewing?.endMinutes ?? block.endMinutes,
      };
    });

    const sorted = [...blocksWithRenderTimes].sort((a, b) => {
      if (a.renderStartMinutes !== b.renderStartMinutes) {
        return a.renderStartMinutes - b.renderStartMinutes;
      }
      return a.renderEndMinutes - b.renderEndMinutes;
    });

    const groups: (typeof sorted)[] = [];
    let currentGroup: typeof sorted = [];
    let currentGroupEnd = -1;

    for (const block of sorted) {
      if (
        currentGroup.length === 0 ||
        block.renderStartMinutes < currentGroupEnd
      ) {
        currentGroup.push(block);
        currentGroupEnd = Math.max(currentGroupEnd, block.renderEndMinutes);
      } else {
        groups.push(currentGroup);
        currentGroup = [block];
        currentGroupEnd = block.renderEndMinutes;
      }
    }

    if (currentGroup.length > 0) {
      groups.push(currentGroup);
    }

    const positioned = new Map<string, PositionedBlock>();

    for (const group of groups) {
      const active: Array<{ laneIndex: number; endMinutes: number }> = [];
      let laneCount = 0;

      for (const block of group) {
        for (let i = active.length - 1; i >= 0; i -= 1) {
          if (active[i]!.endMinutes <= block.renderStartMinutes) {
            active.splice(i, 1);
          }
        }

        const usedLanes = new Set(active.map((entry) => entry.laneIndex));
        let laneIndex = 0;
        while (usedLanes.has(laneIndex)) {
          laneIndex += 1;
        }

        active.push({ laneIndex, endMinutes: block.renderEndMinutes });
        laneCount = Math.max(laneCount, laneIndex + 1);

        positioned.set(block.id, {
          ...block,
          laneIndex,
          laneCount: 1,
        });
      }

      for (const block of group) {
        const existing = positioned.get(block.id);
        if (!existing) continue;
        const concurrentCount = group.reduce((count, other) => {
          const overlaps =
            other.renderStartMinutes < block.renderEndMinutes &&
            other.renderEndMinutes > block.renderStartMinutes;
          return overlaps ? count + 1 : count;
        }, 0);
        existing.laneCount = isMobileLayout
          ? 1
          : Math.max(1, Math.min(laneCount, concurrentCount));
        if (isMobileLayout) {
          existing.laneIndex = 0;
        }
      }
    }

    return blocks
      .map((block) => positioned.get(block.id))
      .filter((block): block is PositionedBlock => Boolean(block));
  }, [blocks, isMobileLayout, preview]);

  const nowLine = useMemo(() => {
    const viewingToday =
      !scheduleDateYmd || scheduleDateYmd === toLocalDateYmd(now);
    if (!viewingToday) {
      return null;
    }

    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    if (nowMinutes < dayStart || nowMinutes > dayEnd) {
      return null;
    }

    return {
      top: (nowMinutes - dayStart) * PX_PER_MINUTE,
      label: formatClock(nowMinutes),
    };
  }, [dayEnd, dayStart, now, scheduleDateYmd]);

  const hourMarks = useMemo(() => {
    const marks: number[] = [];
    for (let minute = dayStart; minute <= dayEnd; minute += 60) {
      marks.push(minute);
    }
    return marks;
  }, [dayStart, dayEnd]);

  const persistAndMaybeSync = useCallback(
    async (nextDocument: PlanDocument, blockId: string) => {
      onDocumentChange(nextDocument);
      setIsSaving(true);
      try {
        await onPersist(nextDocument);
        if (onSyncBlock) {
          const synced = await onSyncBlock(nextDocument, blockId);
          if (synced) {
            onDocumentChange(synced);
            await onPersist(synced);
          }
        }
      } finally {
        setIsSaving(false);
      }
    },
    [onDocumentChange, onPersist, onSyncBlock],
  );

  const applyBlockTimes = useCallback(
    async (blockId: string, startMinutes: number, endMinutes: number) => {
      const nextDocument = updatePlanBlock(document, blockId, {
        startMinutes,
        endMinutes,
      });
      await persistAndMaybeSync(nextDocument, blockId);
    },
    [document, persistAndMaybeSync],
  );

  const applyDuration = useCallback(
    async (blockId: string, durationMinutes: number) => {
      const validDuration = findValidDuration(blocks, blockId, durationMinutes);
      if (validDuration === null) {
        toast.error('That duration does not fit in the available gap');
        return;
      }

      const nextDocument = setPlanBlockDuration(
        document,
        blockId,
        validDuration,
      );
      await persistAndMaybeSync(nextDocument, blockId);
    },
    [blocks, document, persistAndMaybeSync],
  );

  useEffect(() => {
    if (!dragState) {
      return;
    }
    const activeDrag = dragState;

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

      if (activeDrag.kind === 'move') {
        const duration = activeDrag.originEnd - activeDrag.originStart;
        const delta =
          pointerMinutes -
          minutesFromPointerY(
            activeDrag.pointerStartY,
            rect.top,
            PX_PER_MINUTE,
            dayStart,
          );
        const proposedStart = snapToQuarterHour(activeDrag.originStart + delta);
        const validStart = findValidDropStart(
          blocks,
          activeDrag.blockId,
          proposedStart,
        );
        setPreview({
          blockId: activeDrag.blockId,
          startMinutes: validStart,
          endMinutes: validStart + duration,
        });
        return;
      }

      const proposedEnd = snapToQuarterHour(
        Math.max(activeDrag.originStart + MIN_BLOCK_MINUTES, pointerMinutes),
      );
      const validation = canPlaceBlock(
        blocks,
        activeDrag.blockId,
        activeDrag.originStart,
        proposedEnd,
      );
      const validEnd = validation.ok ? proposedEnd : activeDrag.originEnd;
      setPreview({
        blockId: activeDrag.blockId,
        startMinutes: activeDrag.originStart,
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
        <p>
          Drag blocks to reschedule. Linked events sync to Google Calendar
          automatically.
        </p>
        {isSaving ? (
          <span className="inline-flex items-center gap-1.5 text-[var(--ozer-accent-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Saving…
          </span>
        ) : null}
      </div>

      <div className="relative w-full min-w-0 overflow-hidden rounded-xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)]">
        {nowLine ? (
          <div
            className="pointer-events-none absolute inset-x-0 z-30 flex items-center"
            style={{ top: nowLine.top }}
            aria-hidden
          >
            <div className="flex w-14 shrink-0 justify-end pr-1.5">
              <span className="rounded-md bg-[var(--ozer-accent)] px-1.5 py-0.5 text-[9px] font-semibold text-white tabular-nums shadow-sm">
                {nowLine.label}
              </span>
            </div>
            <div className="relative h-[2px] min-w-0 flex-1 bg-[var(--ozer-accent)]">
              <span className="absolute top-1/2 -left-1 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-[var(--ozer-accent)] ring-2 ring-[var(--workspace-shell-panel)]" />
            </div>
          </div>
        ) : null}

        <div className="flex w-full min-w-0">
          <div
            className="relative w-14 shrink-0 border-r border-[color:var(--workspace-shell-border)] bg-black/10"
            style={{ height: gridHeight }}
          >
            {hourMarks.map((minute) => (
              <div
                key={minute}
                className="absolute right-2 -translate-y-1/2 text-[10px] text-[var(--workspace-shell-text)]/35 tabular-nums"
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

            {positionedBlocks.map((block) => {
              const startMinutes = block.renderStartMinutes;
              const endMinutes = block.renderEndMinutes;
              const top = (startMinutes - dayStart) * PX_PER_MINUTE;
              const height = Math.max(
                (endMinutes - startMinutes) * PX_PER_MINUTE,
                MIN_BLOCK_MINUTES * PX_PER_MINUTE,
              );
              const laneGapPx = block.laneCount > 1 ? 6 : 0;
              const laneWidthPct = 100 / block.laneCount;
              const leftInset =
                block.laneCount > 1
                  ? `calc(${laneWidthPct * block.laneIndex}% + ${laneGapPx}px)`
                  : '0.5rem';
              const rightInset =
                block.laneCount > 1
                  ? `calc(${100 - laneWidthPct * (block.laneIndex + 1)}% + ${laneGapPx}px)`
                  : '0.5rem';
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
                    'absolute overflow-hidden rounded-lg border px-2 py-1.5 text-left shadow-sm',
                    block.isCalendarEvent
                      ? 'border-[color:var(--workspace-shell-border)] bg-sky-400/15'
                      : block.isBreak
                        ? 'border-dashed border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-sidebar-accent)]'
                        : 'border-[var(--ozer-accent)]/25 bg-[var(--ozer-accent-subtle)]',
                    status === 'current' && 'ring-1 ring-[#FF5C34]/40',
                    status === 'past' && 'opacity-50',
                    dragState?.blockId === block.id && 'z-20 opacity-90',
                    !block.movable && 'cursor-default',
                  )}
                  style={{ top, height, left: leftInset, right: rightInset }}
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
                            event.currentTarget.setPointerCapture(
                              event.pointerId,
                            );
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
                              ? 'text-[var(--workspace-shell-text)]/45 italic'
                              : 'text-[var(--workspace-shell-text)]',
                          )}
                        >
                          {block.title}
                        </p>
                        <p className="text-[10px] text-[var(--workspace-shell-text)]/40 tabular-nums">
                          {formatClock(startMinutes)} –{' '}
                          {formatClock(endMinutes)}
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
                          event.currentTarget.setPointerCapture(
                            event.pointerId,
                          );
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
