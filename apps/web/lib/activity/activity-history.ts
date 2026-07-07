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
  url: string | null;
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

export type ActivityAppGroup = {
  appKey: string;
  appName: string;
  blocks: ActivityBlockListRow[];
  totalDurationSeconds: number;
};

export type ActivitySortKey = 'app' | 'duration' | 'time';
export type ActivitySortDir = 'asc' | 'desc';

export function sortActivityBlocks(
  blocks: ActivityBlockListRow[],
  sortKey: ActivitySortKey,
  sortDir: ActivitySortDir,
): ActivityBlockListRow[] {
  const factor = sortDir === 'asc' ? 1 : -1;

  return [...blocks].sort((left, right) => {
    switch (sortKey) {
      case 'app':
        return factor * left.appName.localeCompare(right.appName, undefined, {
          sensitivity: 'base',
        });
      case 'duration':
        return factor * (left.durationSeconds - right.durationSeconds);
      case 'time':
        return factor * left.startedAt.localeCompare(right.startedAt);
      default:
        return 0;
    }
  });
}

export function sortActivityAppGroups(
  groups: ActivityAppGroup[],
  sortKey: ActivitySortKey,
  sortDir: ActivitySortDir,
): ActivityAppGroup[] {
  const factor = sortDir === 'asc' ? 1 : -1;

  return [...groups]
    .sort((left, right) => {
      switch (sortKey) {
        case 'app':
          return factor * left.appName.localeCompare(right.appName, undefined, {
            sensitivity: 'base',
          });
        case 'duration':
          return factor * (left.totalDurationSeconds - right.totalDurationSeconds);
        case 'time': {
          const leftTime = left.blocks[0]?.startedAt ?? '';
          const rightTime = right.blocks[0]?.startedAt ?? '';
          return factor * leftTime.localeCompare(rightTime);
        }
        default:
          return 0;
      }
    })
    .map((group) => ({
      ...group,
      blocks: sortActivityBlocks(group.blocks, sortKey, sortDir),
    }));
}

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

export function blockPageTitle(block: ActivityBlockListRow): string {
  const title = block.windowTitle.trim();
  if (title) {
    return title;
  }

  if (block.domain) {
    return block.domain;
  }

  return block.appName;
}

export function blockUrlLabel(block: ActivityBlockListRow): string | null {
  if (block.url?.trim()) {
    return block.url.trim();
  }

  if (block.domain?.trim()) {
    return block.domain.trim();
  }

  return null;
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

export function activityAppGroupKey(block: ActivityBlockListRow): string {
  const bundleId = block.bundleId.trim();
  if (bundleId) {
    return bundleId;
  }

  return block.appName.trim().toLowerCase();
}

export function groupBlocksByApp(
  blocks: ActivityBlockListRow[],
): ActivityAppGroup[] {
  const groups = new Map<string, ActivityBlockListRow[]>();
  const appNames = new Map<string, string>();

  for (const block of blocks) {
    const appKey = activityAppGroupKey(block);
    const existing = groups.get(appKey) ?? [];
    existing.push(block);
    groups.set(appKey, existing);

    if (!appNames.has(appKey)) {
      appNames.set(appKey, block.appName);
    }
  }

  return [...groups.entries()]
    .map(([appKey, appBlocks]) => {
      const sortedBlocks = appBlocks.sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      );

      return {
        appKey,
        appName: appNames.get(appKey) ?? appKey,
        blocks: sortedBlocks,
        totalDurationSeconds: sumActiveDuration(sortedBlocks),
      };
    })
    .sort((left, right) => right.totalDurationSeconds - left.totalDurationSeconds);
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
