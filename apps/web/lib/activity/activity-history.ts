import {
  format,
  isToday,
  isYesterday,
  parseISO,
} from 'date-fns';

export type ActivityRangeKey = 'today' | '7d' | '30d';

export type ActivityBlockStatus =
  | 'excluded'
  | 'confirmed'
  | 'suggested'
  | 'unassigned';

export type ActivityBlockListRow = {
  id: string;
  userId: string;
  userName: string | null;
  appName: string;
  bundleId: string;
  domain: string | null;
  windowTitle: string;
  startedAt: string;
  endedAt: string;
  durationSeconds: number;
  projectId: string | null;
  projectName: string | null;
  clientId: string | null;
  clientName: string | null;
  confidenceScore: number | null;
  isConfirmed: boolean;
  isExcluded: boolean;
};

export type ActivityDayGroup = {
  dayKey: string;
  label: string;
  blocks: ActivityBlockListRow[];
  totalDurationSeconds: number;
};

export function parseActivityRange(value: string | null | undefined): ActivityRangeKey {
  if (value === 'today' || value === '30d') {
    return value;
  }

  return '7d';
}

export function parseActivityView(
  value: string | null | undefined,
): 'mine' | 'team' {
  return value === 'team' ? 'team' : 'mine';
}

export function resolveRangeStart(
  range: ActivityRangeKey,
  now = new Date(),
): Date {
  const start = new Date(now);

  if (range === 'today') {
    start.setHours(0, 0, 0, 0);
    return start;
  }

  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (range === '30d' ? 30 : 7));
  return start;
}

export function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
  }

  if (minutes > 0) {
    return `${minutes}m`;
  }

  return `${seconds}s`;
}

export function formatTimeRange(startIso: string, endIso: string): string {
  const start = parseISO(startIso);
  const end = parseISO(endIso);
  return `${format(start, 'HH:mm')}–${format(end, 'HH:mm')}`;
}

export function blockStatusLabel(block: ActivityBlockListRow): ActivityBlockStatus {
  if (block.isExcluded) {
    return 'excluded';
  }

  if (block.isConfirmed) {
    return 'confirmed';
  }

  if (block.projectId || block.clientId) {
    return 'suggested';
  }

  return 'unassigned';
}

export function blockStatusText(status: ActivityBlockStatus): string {
  switch (status) {
    case 'excluded':
      return 'Excluded';
    case 'confirmed':
      return 'Confirmed';
    case 'suggested':
      return 'Suggested';
    default:
      return 'Unassigned';
  }
}

export function blockPrimaryLabel(block: ActivityBlockListRow): string {
  if (block.domain) {
    return block.domain;
  }

  if (block.windowTitle.trim()) {
    return block.windowTitle.trim();
  }

  return block.appName;
}

export function sumActiveDuration(blocks: ActivityBlockListRow[]): number {
  return blocks.reduce(
    (total, block) => (block.isExcluded ? total : total + block.durationSeconds),
    0,
  );
}

export function sumTodayActiveDuration(
  blocks: ActivityBlockListRow[],
  now = new Date(),
): number {
  return sumActiveDuration(
    blocks.filter((block) => isToday(parseISO(block.startedAt))),
  );
}

export function groupBlocksByDay(
  blocks: ActivityBlockListRow[],
  now = new Date(),
): ActivityDayGroup[] {
  const groups = new Map<string, ActivityBlockListRow[]>();

  for (const block of blocks) {
    const dayKey = format(parseISO(block.startedAt), 'yyyy-MM-dd');
    const existing = groups.get(dayKey) ?? [];
    existing.push(block);
    groups.set(dayKey, existing);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([dayKey, dayBlocks]) => {
      const date = parseISO(`${dayKey}T12:00:00`);
      let label = format(date, 'EEEE, d MMMM yyyy');

      if (isToday(date)) {
        label = 'Today';
      } else if (isYesterday(date)) {
        label = 'Yesterday';
      }

      return {
        dayKey,
        label,
        blocks: dayBlocks.sort((a, b) => b.startedAt.localeCompare(a.startedAt)),
        totalDurationSeconds: sumActiveDuration(dayBlocks),
      };
    });
}
