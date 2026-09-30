export type TimelinePhaseInput = {
  id: string;
  name: string;
  colour: string | null;
  startDate: string | null;
  dueDate: string | null;
  isMilestone: boolean;
  progressPct: number;
};

export type TimelineTaskInput = {
  id: string;
  title: string;
  phaseId: string | null;
  dueDate: string | null;
  done: boolean;
};

export type TimelineMarker = {
  id: string;
  title: string;
  /** 0–1 across the range. */
  at: number;
  done: boolean;
  overdue: boolean;
};

export type TimelineRow = {
  id: string | null;
  name: string;
  colour: string | null;
  /** Bar from `from` to `to` (0–1); a milestone or single date has from === to. */
  from: number | null;
  to: number | null;
  milestone: boolean;
  progressPct: number;
  tasks: TimelineMarker[];
};

export type TimelineTick = { at: number; label: string; major: boolean };

export type CanvasTimelineLayout = {
  start: Date;
  end: Date;
  rows: TimelineRow[];
  ticks: TimelineTick[];
  /** Today's position, when inside the range. */
  today: number | null;
  undatedPhases: string[];
};

const DAY = 86_400_000;

/** `YYYY-MM-DD` (or ISO) to a local-midnight date. */
function parseDay(value: string | null): Date | null {
  if (!value) return null;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function midday(date: Date) {
  return new Date(date.getTime() + DAY / 2);
}

/**
 * Lays phases (and optionally task due dates) out on a shared date axis.
 * Positions are fractions so the card can be any width.
 */
export function buildCanvasTimeline(input: {
  phases: TimelinePhaseInput[];
  tasks: TimelineTaskInput[];
  showTasks: boolean;
  today: Date;
}): CanvasTimelineLayout | null {
  const today = startOfDay(input.today);
  const dates: Date[] = [];
  for (const phase of input.phases) {
    for (const value of [phase.startDate, phase.dueDate]) {
      const date = parseDay(value);
      if (date) dates.push(date);
    }
  }
  const tasks = input.showTasks
    ? input.tasks
        .map((task) => ({ ...task, due: parseDay(task.dueDate) }))
        .filter((task): task is typeof task & { due: Date } => !!task.due)
    : [];
  for (const task of tasks) dates.push(task.due);
  if (dates.length === 0) return null;

  const min = new Date(
    Math.min(...dates.map((d) => d.getTime()), today.getTime()),
  );
  const max = new Date(
    Math.max(...dates.map((d) => d.getTime()), today.getTime()),
  );
  const spanDays = Math.max(
    1,
    Math.round((max.getTime() - min.getTime()) / DAY),
  );
  const pad = Math.max(3, Math.round(spanDays * 0.04));
  const start = addDays(min, -pad);
  const end = addDays(max, pad + 1);
  const total = end.getTime() - start.getTime();
  const at = (date: Date) => (date.getTime() - start.getTime()) / total;

  const rows: TimelineRow[] = [];
  const undatedPhases: string[] = [];
  const rowByPhase = new Map<string | null, TimelineRow>();
  for (const phase of input.phases) {
    const from = parseDay(phase.startDate);
    const due = parseDay(phase.dueDate);
    if (!from && !due) undatedPhases.push(phase.name);
    const milestone = phase.isMilestone || !from || !due;
    const point = due ?? from;
    const row: TimelineRow = {
      id: phase.id,
      name: phase.name,
      colour: phase.colour,
      from: milestone ? point && at(midday(point)) : from && at(from),
      to: milestone ? point && at(midday(point)) : due && at(addDays(due, 1)),
      milestone,
      progressPct: phase.progressPct,
      tasks: [],
    };
    rows.push(row);
    rowByPhase.set(phase.id, row);
  }

  for (const task of tasks) {
    let row = task.phaseId ? rowByPhase.get(task.phaseId) : undefined;
    if (!row) {
      row = rowByPhase.get(null);
      if (!row) {
        row = {
          id: null,
          name: 'No phase',
          colour: null,
          from: null,
          to: null,
          milestone: false,
          progressPct: 0,
          tasks: [],
        };
        rows.push(row);
        rowByPhase.set(null, row);
      }
    }
    row.tasks.push({
      id: task.id,
      title: task.title,
      at: at(midday(task.due)),
      done: task.done,
      overdue: !task.done && task.due.getTime() < today.getTime(),
    });
  }

  return {
    start,
    end,
    rows,
    ticks: timelineTicks(start, end),
    today: at(midday(today)),
    undatedPhases,
  };
}

/** Weekly ticks for short ranges, monthly otherwise. */
export function timelineTicks(start: Date, end: Date): TimelineTick[] {
  const total = end.getTime() - start.getTime();
  const days = total / DAY;
  const ticks: TimelineTick[] = [];
  if (days <= 84) {
    const cursor = startOfDay(start);
    cursor.setDate(cursor.getDate() + ((8 - cursor.getDay()) % 7));
    while (cursor < end) {
      ticks.push({
        at: (cursor.getTime() - start.getTime()) / total,
        label: cursor.toLocaleDateString('en-GB', {
          day: 'numeric',
          month: 'short',
        }),
        major: cursor.getDate() <= 7,
      });
      cursor.setDate(cursor.getDate() + 7);
    }
    return ticks;
  }
  const step = days > 730 ? 3 : 1;
  const cursor = new Date(start.getFullYear(), start.getMonth() + 1, 1);
  while (cursor < end) {
    ticks.push({
      at: (cursor.getTime() - start.getTime()) / total,
      label: cursor.toLocaleDateString('en-GB', {
        month: 'short',
        ...(cursor.getMonth() === 0 || ticks.length === 0
          ? { year: '2-digit' }
          : {}),
      }),
      major: cursor.getMonth() === 0,
    });
    cursor.setMonth(cursor.getMonth() + step);
  }
  return ticks;
}
