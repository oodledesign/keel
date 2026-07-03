import type { EditablePlanBlock } from './plan-blocks';

export const QUARTER_HOUR_MINUTES = 15;
export const MIN_BLOCK_MINUTES = 15;

export function snapToQuarterHour(minutes: number): number {
  return Math.round(minutes / QUARTER_HOUR_MINUTES) * QUARTER_HOUR_MINUTES;
}

export function blocksOverlap(
  aStart: number,
  aEnd: number,
  bStart: number,
  bEnd: number,
): boolean {
  return aStart < bEnd && aEnd > bStart;
}

export function getDayBounds(blocks: EditablePlanBlock[]) {
  if (blocks.length === 0) {
    return { dayStart: 8 * 60, dayEnd: 18 * 60 };
  }

  const minStart = Math.min(...blocks.map((block) => block.startMinutes));
  const maxEnd = Math.max(...blocks.map((block) => block.endMinutes));

  return {
    dayStart: Math.max(0, Math.floor((minStart - 60) / 60) * 60),
    dayEnd: Math.min(24 * 60, Math.ceil((maxEnd + 60) / 60) * 60),
  };
}

export function canPlaceBlock(
  blocks: EditablePlanBlock[],
  blockId: string,
  newStartMinutes: number,
  newEndMinutes: number,
): { ok: boolean; reason?: string } {
  const moving = blocks.find((block) => block.id === blockId);
  if (!moving) {
    return { ok: false, reason: 'Block not found' };
  }

  if (!moving.movable) {
    return { ok: false, reason: 'This block cannot be moved' };
  }

  const duration = newEndMinutes - newStartMinutes;
  if (duration < MIN_BLOCK_MINUTES) {
    return { ok: false, reason: 'Block is too short' };
  }

  const { dayStart, dayEnd } = getDayBounds(blocks);
  if (newStartMinutes < dayStart || newEndMinutes > dayEnd) {
    return { ok: false, reason: 'Outside the visible day range' };
  }

  for (const other of blocks) {
    if (other.id === blockId) {
      continue;
    }

    if (
      blocksOverlap(
        newStartMinutes,
        newEndMinutes,
        other.startMinutes,
        other.endMinutes,
      )
    ) {
      return {
        ok: false,
        reason: other.isCalendarEvent
          ? 'Overlaps a calendar event'
          : 'Overlaps another block',
      };
    }
  }

  return { ok: true };
}

export function findValidDropStart(
  blocks: EditablePlanBlock[],
  blockId: string,
  proposedStartMinutes: number,
): number {
  const block = blocks.find((item) => item.id === blockId);
  if (!block) {
    return proposedStartMinutes;
  }

  const duration = block.endMinutes - block.startMinutes;
  const { dayStart, dayEnd } = getDayBounds(blocks);
  const snapped = snapToQuarterHour(proposedStartMinutes);
  const clamped = Math.max(
    dayStart,
    Math.min(snapped, dayEnd - duration),
  );

  if (
    canPlaceBlock(blocks, blockId, clamped, clamped + duration).ok
  ) {
    return clamped;
  }

  for (let delta = QUARTER_HOUR_MINUTES; delta <= 8 * 60; delta += QUARTER_HOUR_MINUTES) {
    for (const candidate of [clamped - delta, clamped + delta]) {
      if (
        canPlaceBlock(blocks, blockId, candidate, candidate + duration).ok
      ) {
        return candidate;
      }
    }
  }

  return block.startMinutes;
}

export function findValidDuration(
  blocks: EditablePlanBlock[],
  blockId: string,
  durationMinutes: number,
): number | null {
  const block = blocks.find((item) => item.id === blockId);
  if (!block || !block.movable) {
    return null;
  }

  const snappedDuration = Math.max(
    MIN_BLOCK_MINUTES,
    snapToQuarterHour(durationMinutes),
  );
  const newEnd = block.startMinutes + snappedDuration;

  if (canPlaceBlock(blocks, blockId, block.startMinutes, newEnd).ok) {
    return snappedDuration;
  }

  return null;
}

export function minutesFromPointerY(
  clientY: number,
  gridTop: number,
  pxPerMinute: number,
  dayStartMinutes: number,
): number {
  return dayStartMinutes + (clientY - gridTop) / pxPerMinute;
}
