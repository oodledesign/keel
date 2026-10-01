const SUFFIX: Record<string, number> = {
  k: 1e3,
  m: 1e6,
  b: 1e9,
};

/**
 * The number inside a typed figure: "£12,400" → 12400, "3.2m" → 3200000,
 * "45%" → 45. Words after the number ("12 months") are ignored.
 */
export function parseMetricNumber(raw: string | undefined | null) {
  if (!raw) return null;
  const match = raw
    .replace(/,/g, '')
    .match(/(-?\d+(?:\.\d+)?)\s*([kmbKMB])?(?![a-zA-Z])/);
  if (!match) return null;
  const base = Number(match[1]);
  if (!Number.isFinite(base)) return null;
  return base * (match[2] ? (SUFFIX[match[2].toLowerCase()] ?? 1) : 1);
}

/** 0–1 progress towards the goal (can exceed 1), or null if either is missing. */
export function metricProgress(
  value: string | undefined | null,
  goal: string | undefined | null,
) {
  const current = parseMetricNumber(value);
  const target = parseMetricNumber(goal);
  if (current === null || target === null || target === 0) return null;
  return Math.max(0, current / target);
}

/* -------------------------------------------------------------------------- */
/* Totalizer: pace against a plan, from a start to a due date                  */
/* -------------------------------------------------------------------------- */

const DAY_MS = 24 * 60 * 60 * 1000;

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** `2026-12-18` → local midnight, or null when it isn't a real date. */
export function parseIsoDate(raw: string | undefined | null): Date | null {
  const match = raw ? ISO_DATE.exec(raw) : null;
  if (!match) return null;
  const date = new Date(
    Number(match[1]),
    Number(match[2]) - 1,
    Number(match[3]),
  );
  return Number.isNaN(date.getTime()) ||
    date.getMonth() !== Number(match[2]) - 1
    ? null
    : date;
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

/** Whole calendar days from `from` to `to` (negative when `to` is earlier). */
function diffDays(from: Date, to: Date): number {
  return Math.round(
    (startOfDay(to).getTime() - startOfDay(from).getTime()) / DAY_MS,
  );
}

export function formatMetricDate(date: Date): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function trimZeros(value: number, digits: number): string {
  return String(Number(value.toFixed(digits)));
}

/**
 * Format a number the way the user typed their figure: "£" and "%" carry over
 * from `sample`, large numbers are shortened (12.4k, 3.2m).
 */
export function formatMetricNumber(
  value: number,
  sample?: string | null,
): string {
  const currency = /^\s*(-?)\s*([£$€])/.exec(sample ?? '')?.[2] ?? '';
  const percent = /%\s*$/.test(sample ?? '');
  const abs = Math.abs(value);
  let body: string;
  if (abs >= 1_000_000) body = `${trimZeros(abs / 1_000_000, 1)}m`;
  else if (abs >= 10_000) body = `${trimZeros(abs / 1000, 1)}k`;
  else
    body = new Intl.NumberFormat('en-GB', {
      maximumFractionDigits: abs < 100 ? 1 : 0,
    }).format(abs);
  return `${value < 0 ? '-' : ''}${currency}${body}${percent ? '%' : ''}`;
}

export type MetricPaceStatus =
  | 'reached'
  | 'ahead'
  | 'on-track'
  | 'behind'
  | 'overdue'
  | 'upcoming';

export type MetricPace = {
  status: MetricPaceStatus;
  /** 0–1+ of the way from start to target. */
  progress: number;
  /** 0–1 of the time that has passed. */
  planFraction: number;
  /** Where a straight line from start to target says we should be today. */
  planValue: number;
  /** Units behind the straight-line plan (negative = ahead). */
  behindBy: number;
  daysLeft: number;
  weeksLeft: number;
  perWeekActual: number | null;
  perWeekNeeded: number | null;
  /** Where today's pace lands on the due date. */
  projected: number | null;
};

/** Pace against a straight-line plan from `start` on `startDate` to `target` on `dueDate`. */
export function computeMetricPace(input: {
  value: number;
  start: number;
  target: number;
  startDate: Date;
  dueDate: Date;
  now: Date;
}): MetricPace | null {
  const { value, start, target, startDate, dueDate, now } = input;
  const span = target - start;
  if (span === 0) return null;

  const totalDays = Math.max(1, diffDays(startDate, dueDate));
  const sinceStart = diffDays(startDate, now);
  const elapsedDays = Math.min(totalDays, Math.max(0, sinceStart));
  const daysLeft = diffDays(now, dueDate);

  const progress = (value - start) / span;
  const planFraction = elapsedDays / totalDays;
  const planValue = start + span * planFraction;
  const direction = Math.sign(span);
  const behindBy = (planValue - value) * direction;
  const gap = progress - planFraction;

  let status: MetricPaceStatus;
  if (progress >= 1) status = 'reached';
  else if (daysLeft < 0) status = 'overdue';
  else if (sinceStart < 0) status = 'upcoming';
  // ±1% of the whole span counts as "on pace".
  else if (gap > 0.01) status = 'ahead';
  else if (gap < -0.01) status = 'behind';
  else status = 'on-track';

  const perWeekActual =
    elapsedDays >= 1 ? (value - start) / (elapsedDays / 7) : null;
  const perWeekNeeded = daysLeft > 0 ? (target - value) / (daysLeft / 7) : null;
  const weeksLeft = Math.max(0, daysLeft) / 7;

  return {
    status,
    progress,
    planFraction,
    planValue,
    behindBy,
    daysLeft,
    weeksLeft,
    perWeekActual,
    perWeekNeeded,
    projected:
      perWeekActual === null ? null : value + perWeekActual * weeksLeft,
  };
}

export type MetricPoint = { date: string; value: number };

/** The last logged value on or before `date`, else `fallback`. */
function valueOnOrBefore(
  history: MetricPoint[],
  date: Date,
  fallback: number,
): number {
  const key = toIsoDate(date);
  let result = fallback;
  for (const point of history) {
    if (point.date <= key) result = point.value;
  }
  return result;
}

/** Change over the last 7 days and the 7 days before that, from logged values. */
export function metricWeeklyChange(input: {
  history: MetricPoint[];
  value: number;
  start: number;
  now: Date;
}): { thisWeek: number; lastWeek: number } | null {
  const history = [...input.history].sort((a, b) =>
    a.date.localeCompare(b.date),
  );
  if (history.length === 0) return null;
  // Calendar arithmetic, so a clock change doesn't push us onto the wrong day.
  const { now } = input;
  const weekAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7,
  );
  const twoWeeksAgo = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 14,
  );
  const atWeekAgo = valueOnOrBefore(history, weekAgo, input.start);
  const atTwoWeeksAgo = valueOnOrBefore(history, twoWeeksAgo, input.start);
  return {
    thisWeek: input.value - atWeekAgo,
    lastWeek: atWeekAgo - atTwoWeeksAgo,
  };
}

/** Add today's reading, replacing an earlier reading from the same day. */
export function logMetricPoint(
  history: MetricPoint[] | undefined,
  value: number,
  now: Date,
  max = 120,
): MetricPoint[] {
  const date = toIsoDate(now);
  const rest = (history ?? []).filter((point) => point.date !== date);
  return [...rest, { date, value }]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(-max);
}

/**
 * Live figures from the project itself: how many top-level tasks are done, or
 * how many phases are complete. The total is what a typed target falls back to.
 */
export function projectMetricCount(
  source: 'tasks' | 'phases',
  project: {
    tasks: Array<{ status: string; parent_task_id: string | null }>;
    phases: Array<{ status: string }>;
  },
): { value: number; total: number } {
  if (source === 'phases') {
    return {
      value: project.phases.filter((phase) => phase.status === 'complete')
        .length,
      total: project.phases.length,
    };
  }
  const tasks = project.tasks.filter(
    (task) => !task.parent_task_id && task.status !== 'cancelled',
  );
  return {
    value: tasks.filter((task) => task.status === 'done').length,
    total: tasks.length,
  };
}

/** Card size that fits the totalizer with `bars` progress bars. */
export function totalizerSize(bars: number) {
  return { w: 380, h: 270 + 64 * Math.max(1, bars) };
}

export type TotalizerBar = {
  label: string;
  /** The target as the user typed it (or the live total). */
  goalText: string;
  goal: number;
  dueDate: Date | null;
  /** The overall target, as opposed to a milestone on the way. */
  isFinal: boolean;
  /** 0–1 fill of the bar. */
  fill: number;
  /** Straight-line plan marker position (0–1) and value, when dated. */
  planFraction: number | null;
  planValue: number | null;
  pace: MetricPace | null;
};

export type TotalizerView = {
  value: number;
  start: number;
  /** Text to copy "£" / "%" from when formatting derived numbers. */
  sample: string;
  bars: TotalizerBar[];
  /** The last target: drives the badge, summary and pace sentence. */
  final: TotalizerBar | null;
  status: MetricPaceStatus | null;
  weekly: { thisWeek: number; lastWeek: number } | null;
  startDate: Date | null;
};

type TotalizerData = {
  value?: string;
  goal?: string;
  start?: string;
  startDate?: string;
  dueDate?: string;
  metricSource?: 'manual' | 'tasks' | 'phases';
  milestones?: Array<{ label: string; goal: string; dueDate?: string }>;
  history?: MetricPoint[];
};

/** Everything the totalizer card shows, worked out from the card's data. */
export function buildTotalizer(
  data: TotalizerData,
  project: Parameters<typeof projectMetricCount>[1],
  now: Date,
): TotalizerView | null {
  const source = data.metricSource ?? 'manual';
  const live = source === 'manual' ? null : projectMetricCount(source, project);
  const value = live ? live.value : parseMetricNumber(data.value);
  if (value === null) return null;

  const start = parseMetricNumber(data.start) ?? 0;
  const startDate = parseIsoDate(data.startDate);
  const sample = data.goal ?? data.value ?? '';

  const raw: Array<
    Omit<TotalizerBar, 'fill' | 'planFraction' | 'planValue' | 'pace'>
  > = [];
  for (const milestone of data.milestones ?? []) {
    const goal = parseMetricNumber(milestone.goal);
    if (goal === null) continue;
    raw.push({
      label: milestone.label.trim() || 'Milestone',
      goalText: milestone.goal,
      goal,
      dueDate: parseIsoDate(milestone.dueDate),
      isFinal: false,
    });
  }
  const primaryGoal = parseMetricNumber(data.goal) ?? live?.total ?? null;
  if (primaryGoal !== null) {
    raw.push({
      label: raw.length > 0 ? 'Final target' : 'Target',
      goalText: data.goal?.trim() || String(primaryGoal),
      goal: primaryGoal,
      dueDate: parseIsoDate(data.dueDate),
      isFinal: true,
    });
  }
  raw.sort((a, b) => {
    if (a.dueDate && b.dueDate)
      return a.dueDate.getTime() - b.dueDate.getTime();
    return a.dueDate ? -1 : b.dueDate ? 1 : 0;
  });

  const bars: TotalizerBar[] = raw.map((bar) => {
    const span = bar.goal - start;
    const pace =
      startDate && bar.dueDate
        ? computeMetricPace({
            value,
            start,
            target: bar.goal,
            startDate,
            dueDate: bar.dueDate,
            now,
          })
        : null;
    const fill =
      span === 0 ? 0 : Math.min(1, Math.max(0, (value - start) / span));
    return {
      ...bar,
      fill,
      planFraction: pace ? Math.min(1, Math.max(0, pace.planFraction)) : null,
      planValue: pace ? pace.planValue : null,
      pace,
    };
  });

  // The overall target drives the badge and sentences, even if a milestone is
  // dated after it.
  const final =
    bars.find((bar) => bar.isFinal) ?? bars[bars.length - 1] ?? null;
  return {
    value,
    start,
    sample,
    bars,
    final,
    status: final?.pace?.status ?? null,
    weekly: data.history?.length
      ? metricWeeklyChange({ history: data.history, value, start, now })
      : null,
    startDate,
  };
}
