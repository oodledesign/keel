import { MIN_BLOCK_MINUTES } from './schedule-constraints';

export const DEFAULT_TASK_DURATION_MINUTES = 30;

export type TimeSlot = {
  startMinutes: number;
  endMinutes: number;
  /** Day or section key so week plans can concatenate slots in order. */
  groupKey?: string;
};

export type BusyInterval = {
  startMinutes: number;
  endMinutes: number;
  groupKey?: string;
};

export type AllocatableTask = {
  id: string;
  title: string;
  durationMinutes: number | null;
  project?: string | null;
};

export type TaskPlacement = {
  taskId: string;
  title: string;
  startMinutes: number;
  endMinutes: number;
  durationMinutes: number;
  partIndex: number;
  partCount: number;
  groupKey?: string;
  project?: string | null;
};

export type UnscheduledTask = {
  taskId: string;
  title: string;
  remainingMinutes: number;
  reason: string;
  project?: string | null;
};

export type AllocateTaskSlotsResult = {
  placements: TaskPlacement[];
  unscheduled: UnscheduledTask[];
};

function slotLength(slot: TimeSlot): number {
  return slot.endMinutes - slot.startMinutes;
}

/**
 * Merge overlapping busy intervals within the same group, then return
 * remaining free slots inside [dayStart, dayEnd].
 */
export function computeFreeSlots(input: {
  dayStartMinutes: number;
  dayEndMinutes: number;
  busy: BusyInterval[];
  groupKey?: string;
}): TimeSlot[] {
  const { dayStartMinutes, dayEndMinutes, groupKey } = input;
  if (dayEndMinutes <= dayStartMinutes) {
    return [];
  }

  const relevant = input.busy
    .filter((interval) => {
      if (groupKey && interval.groupKey && interval.groupKey !== groupKey) {
        return false;
      }
      return (
        interval.endMinutes > dayStartMinutes &&
        interval.startMinutes < dayEndMinutes
      );
    })
    .map((interval) => ({
      startMinutes: Math.max(interval.startMinutes, dayStartMinutes),
      endMinutes: Math.min(interval.endMinutes, dayEndMinutes),
    }))
    .filter((interval) => interval.endMinutes > interval.startMinutes)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const merged: Array<{ startMinutes: number; endMinutes: number }> = [];
  for (const interval of relevant) {
    const last = merged[merged.length - 1];
    if (!last || interval.startMinutes > last.endMinutes) {
      merged.push({ ...interval });
      continue;
    }
    last.endMinutes = Math.max(last.endMinutes, interval.endMinutes);
  }

  const free: TimeSlot[] = [];
  let cursor = dayStartMinutes;

  for (const interval of merged) {
    if (interval.startMinutes > cursor) {
      free.push({
        startMinutes: cursor,
        endMinutes: interval.startMinutes,
        groupKey,
      });
    }
    cursor = Math.max(cursor, interval.endMinutes);
  }

  if (cursor < dayEndMinutes) {
    free.push({
      startMinutes: cursor,
      endMinutes: dayEndMinutes,
      groupKey,
    });
  }

  return free.filter((slot) => slotLength(slot) >= MIN_BLOCK_MINUTES);
}

function consumeSlot(
  slots: TimeSlot[],
  index: number,
  takeMinutes: number,
): void {
  const slot = slots[index];
  if (!slot) return;

  slot.startMinutes += takeMinutes;
  if (slotLength(slot) < MIN_BLOCK_MINUTES) {
    slots.splice(index, 1);
  }
}

function resolveTaskDuration(task: AllocatableTask): number {
  if (task.durationMinutes != null && task.durationMinutes > 0) {
    return task.durationMinutes;
  }

  return DEFAULT_TASK_DURATION_MINUTES;
}

function splitLabel(title: string, partIndex: number, partCount: number) {
  if (partCount <= 1) {
    return title;
  }

  return `${title} (${partIndex}/${partCount})`;
}

/**
 * Place tasks into free slots in order. A task that does not fit in one
 * contiguous gap is split across later slots instead of being overstuffed
 * or dropped. Leftover minutes that cannot fit are returned as unscheduled.
 */
export function allocateTasksIntoSlots(
  tasks: AllocatableTask[],
  slotsInput: TimeSlot[],
): AllocateTaskSlotsResult {
  const slots = slotsInput
    .filter((slot) => slotLength(slot) > 0)
    .map((slot) => ({ ...slot }));

  const placements: TaskPlacement[] = [];
  const unscheduled: UnscheduledTask[] = [];

  for (const task of tasks) {
    let remaining = resolveTaskDuration(task);
    const parts: Array<
      Omit<TaskPlacement, 'partIndex' | 'partCount' | 'title'>
    > = [];

    while (remaining > 0 && slots.length > 0) {
      const wholeIndex = slots.findIndex(
        (slot) => slotLength(slot) >= remaining,
      );

      if (wholeIndex >= 0 && parts.length === 0) {
        const slot = slots[wholeIndex]!;
        const take = remaining;
        parts.push({
          taskId: task.id,
          startMinutes: slot.startMinutes,
          endMinutes: slot.startMinutes + take,
          durationMinutes: take,
          groupKey: slot.groupKey,
          project: task.project,
        });
        consumeSlot(slots, wholeIndex, take);
        remaining = 0;
        break;
      }

      const slot = slots[0]!;
      const available = slotLength(slot);
      const take = Math.min(remaining, available);

      if (take < MIN_BLOCK_MINUTES && take < remaining) {
        // A leftover shorter than the minimum block — skip this tiny gap
        // and keep looking, rather than creating a useless fragment.
        slots.shift();
        continue;
      }

      parts.push({
        taskId: task.id,
        startMinutes: slot.startMinutes,
        endMinutes: slot.startMinutes + take,
        durationMinutes: take,
        groupKey: slot.groupKey,
        project: task.project,
      });
      consumeSlot(slots, 0, take);
      remaining -= take;
    }

    if (parts.length === 0) {
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        remainingMinutes: remaining,
        reason: 'No free time left in working hours',
        project: task.project,
      });
      continue;
    }

    const partCount = parts.length;
    for (const [index, part] of parts.entries()) {
      placements.push({
        ...part,
        title: splitLabel(task.title, index + 1, partCount),
        partIndex: index + 1,
        partCount,
      });
    }

    if (remaining > 0) {
      unscheduled.push({
        taskId: task.id,
        title: task.title,
        remainingMinutes: remaining,
        reason:
          parts.length > 1
            ? `Split across ${parts.length} slots; ${remaining}m still unscheduled`
            : `Not enough free time (${remaining}m left)`,
        project: task.project,
      });
    }
  }

  return { placements, unscheduled };
}

/** Parse planner working-hours strings such as `08:30`, `8:30am`, `17:30`. */
export function parseClockToMinutes(raw: string): number | null {
  const trimmed = raw.trim().toLowerCase();
  const match = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/.exec(trimmed);
  if (!match?.[1]) {
    return null;
  }

  let hours = Number(match[1]);
  const minutes = Number(match[2] ?? '0');
  const meridiem = match[3];

  if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
    return null;
  }

  if (meridiem === 'pm' && hours < 12) hours += 12;
  if (meridiem === 'am' && hours === 12) hours = 0;
  if (hours > 23 || minutes > 59) {
    return null;
  }

  return hours * 60 + minutes;
}
