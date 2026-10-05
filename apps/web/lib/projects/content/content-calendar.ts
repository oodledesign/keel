/**
 * Content calendar and roadmap maths. Dates are plain `YYYY-MM-DD` strings and
 * all arithmetic is done in UTC so a day never shifts with the viewer's zone.
 */

export const CONTENT_PLATFORMS = [
  { key: 'instagram', label: 'Instagram', short: 'IG', color: '#E1306C' },
  { key: 'facebook', label: 'Facebook', short: 'FB', color: '#1877F2' },
  { key: 'linkedin', label: 'LinkedIn', short: 'in', color: '#0A66C2' },
  { key: 'x', label: 'X', short: 'X', color: '#111111' },
  { key: 'tiktok', label: 'TikTok', short: 'TT', color: '#00A6A6' },
  { key: 'youtube', label: 'YouTube', short: 'YT', color: '#E62117' },
  { key: 'threads', label: 'Threads', short: 'Th', color: '#444444' },
  { key: 'pinterest', label: 'Pinterest', short: 'Pi', color: '#BD081C' },
  { key: 'email', label: 'Email', short: '@', color: '#B45309' },
  { key: 'blog', label: 'Blog', short: 'Bl', color: '#0F766E' },
  { key: 'other', label: 'Other', short: '•', color: '#6B5B63' },
] as const;

export type ContentPlatform = (typeof CONTENT_PLATFORMS)[number]['key'];

export const CONTENT_PLATFORM_KEYS = CONTENT_PLATFORMS.map(
  (platform) => platform.key,
) as [ContentPlatform, ...ContentPlatform[]];

export function contentPlatform(key: string) {
  return CONTENT_PLATFORMS.find((platform) => platform.key === key);
}

export const CONTENT_STATUSES = [
  { key: 'idea', label: 'Idea', bg: '#EFEAE3', fg: '#6B5B63' },
  { key: 'draft', label: 'Draft', bg: '#E0E7FF', fg: '#3730A3' },
  { key: 'scheduled', label: 'Scheduled', bg: '#FEF3C7', fg: '#92400E' },
  { key: 'posted', label: 'Posted', bg: '#DCFCE7', fg: '#166534' },
] as const;

export type ContentStatus = (typeof CONTENT_STATUSES)[number]['key'];

export const CONTENT_STATUS_KEYS = CONTENT_STATUSES.map(
  (status) => status.key,
) as [ContentStatus, ...ContentStatus[]];

export function contentStatus(key: string) {
  return CONTENT_STATUSES.find((status) => status.key === key)!;
}

export type ContentPost = {
  id: string;
  postDate: string;
  postTime: string | null;
  title: string;
  body: string;
  status: ContentStatus;
  platforms: ContentPlatform[];
  linkUrl: string | null;
};

export type PeriodKind = 'week' | 'month';

export type PeriodNote = {
  id: string;
  kind: PeriodKind;
  periodStart: string;
  body: string;
};

const DAY_MS = 86_400_000;

export function parseYmd(ymd: string) {
  const [y, m, d] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y!, (m ?? 1) - 1, d ?? 1));
}

export function toYmd(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number) {
  return toYmd(new Date(parseYmd(ymd).getTime() + days * DAY_MS));
}

export function diffDays(from: string, to: string) {
  return Math.round(
    (parseYmd(to).getTime() - parseYmd(from).getTime()) / DAY_MS,
  );
}

/** Monday of the week containing `ymd`. */
export function weekStart(ymd: string) {
  const day = parseYmd(ymd).getUTCDay();
  return addDays(ymd, -((day + 6) % 7));
}

export function monthStart(ymd: string) {
  return `${ymd.slice(0, 7)}-01`;
}

export function addMonths(ymd: string, months: number) {
  const date = parseYmd(monthStart(ymd));
  return toYmd(
    new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1)),
  );
}

export function daysInMonth(ymd: string) {
  const date = parseYmd(monthStart(ymd));
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0),
  ).getUTCDate();
}

export function todayYmd() {
  const now = new Date();
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export type CalendarDay = {
  ymd: string;
  inMonth: boolean;
};

/** Monday-first weeks covering the month, each with seven days. */
export function monthGrid(monthYmd: string): CalendarDay[][] {
  const first = monthStart(monthYmd);
  const total = daysInMonth(first);
  const last = addDays(first, total - 1);
  const weeks: CalendarDay[][] = [];

  for (
    let cursor = weekStart(first);
    cursor <= last;
    cursor = addDays(cursor, 7)
  ) {
    weeks.push(
      Array.from({ length: 7 }, (_, index) => {
        const ymd = addDays(cursor, index);
        return { ymd, inMonth: ymd.slice(0, 7) === first.slice(0, 7) };
      }),
    );
  }

  return weeks;
}

export function formatMonthTitle(ymd: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    month: 'long',
    year: 'numeric',
  }).format(parseYmd(ymd));
}

export function formatDayMonth(ymd: string) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(parseYmd(ymd));
}

export function formatWeekday(ymd: string, style: 'short' | 'long' = 'short') {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'UTC',
    weekday: style,
  }).format(parseYmd(ymd));
}

export function groupPostsByDate(posts: ContentPost[]) {
  const byDate = new Map<string, ContentPost[]>();
  for (const post of posts) {
    const list = byDate.get(post.postDate) ?? [];
    list.push(post);
    byDate.set(post.postDate, list);
  }
  for (const list of byDate.values()) {
    list.sort((left, right) =>
      (left.postTime ?? '99:99').localeCompare(right.postTime ?? '99:99'),
    );
  }
  return byDate;
}

export function noteKey(kind: PeriodKind, periodStart: string) {
  return `${kind}:${periodStart}`;
}

export function indexNotes(notes: PeriodNote[]) {
  return new Map(
    notes.map((note) => [noteKey(note.kind, note.periodStart), note]),
  );
}

// ---------------------------------------------------------------------------
// Roadmap
// ---------------------------------------------------------------------------

export type RoadmapZoom = 'weeks' | 'months';

export type RoadmapColumn = {
  /** First day of the column. */
  start: string;
  /** First day after the column. */
  end: string;
  label: string;
  /** Month heading this column sits under (weeks zoom). */
  group: string;
};

/** Columns covering `from`..`to` (inclusive), by week or by month. */
export function roadmapColumns(
  from: string,
  to: string,
  zoom: RoadmapZoom,
): RoadmapColumn[] {
  const columns: RoadmapColumn[] = [];

  if (zoom === 'months') {
    for (
      let cursor = monthStart(from);
      cursor <= to;
      cursor = addMonths(cursor, 1)
    ) {
      const title = formatMonthTitle(cursor);
      columns.push({
        start: cursor,
        end: addMonths(cursor, 1),
        label: new Intl.DateTimeFormat('en-GB', {
          timeZone: 'UTC',
          month: 'short',
        }).format(parseYmd(cursor)),
        group: title.split(' ')[1] ?? title,
      });
    }
    return columns;
  }

  for (
    let cursor = weekStart(from);
    cursor <= to;
    cursor = addDays(cursor, 7)
  ) {
    columns.push({
      start: cursor,
      end: addDays(cursor, 7),
      label: formatDayMonth(cursor),
      group: formatMonthTitle(cursor),
    });
  }
  return columns;
}

/** Index of the column holding `ymd`, or -1 when it falls outside. */
export function columnIndexFor(columns: RoadmapColumn[], ymd: string) {
  return columns.findIndex((column) => ymd >= column.start && ymd < column.end);
}

/**
 * Horizontal position of a date as a fraction of the column range
 * (0 = left edge of the first column, columns.length = right edge of the last).
 */
export function columnPosition(columns: RoadmapColumn[], ymd: string) {
  if (columns.length === 0) return 0;
  if (ymd < columns[0]!.start) return 0;
  const last = columns[columns.length - 1]!;
  if (ymd >= last.end) return columns.length;
  const index = columnIndexFor(columns, ymd);
  const column = columns[index]!;
  const span = diffDays(column.start, column.end);
  return index + diffDays(column.start, ymd) / span;
}

export type RoadmapRangeInput = {
  today: string;
  dates: Array<string | null | undefined>;
};

/** A readable window: everything dated, plus room either side of today. */
export function roadmapRange({ today, dates }: RoadmapRangeInput) {
  const dated = dates.filter((value): value is string => Boolean(value));
  let from = addDays(today, -28);
  let to = addDays(today, 120);
  for (const ymd of dated) {
    if (ymd < from) from = ymd;
    if (ymd > to) to = ymd;
  }
  // Keep the strip scrollable rather than enormous.
  const earliest = addDays(today, -366);
  const latest = addDays(today, 366 * 2);
  if (from < earliest) from = earliest;
  if (to > latest) to = latest;
  return { from, to: addDays(to, 14) };
}

export type RoadmapBar = {
  start: number;
  end: number;
};

/** A phase's bar in column units; falls back to a two week bar ending on its due date. */
export function phaseBar(
  columns: RoadmapColumn[],
  startDate: string | null,
  dueDate: string | null,
): RoadmapBar | null {
  const start = startDate ?? (dueDate ? addDays(dueDate, -13) : null);
  const end = dueDate ?? (startDate ? addDays(startDate, 13) : null);
  if (!start || !end) return null;
  const left = columnPosition(columns, start <= end ? start : end);
  const right = columnPosition(columns, addDays(start <= end ? end : start, 1));
  return { start: left, end: Math.max(right, left + 0.25) };
}
