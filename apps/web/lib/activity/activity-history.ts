import {
  endOfDay,
  format,
  isToday,
  isYesterday,
  parseISO,
  startOfDay,
} from 'date-fns';

export {
  activityRuleMatchKey,
  findActivityRuleMatchByKey,
  getActivityRuleMatchOptions,
  inferActivityRuleMatch,
  intersectActivityRuleMatchOptions,
  type ActivityRuleMatch,
  type ActivityRuleMatchLevel,
} from './activity-app-context';

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
  workClassification?: 'billable' | 'internal' | 'neutral';
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
  domainLabel: string | null;
  blocks: ActivityBlockListRow[];
  sessionGroups: ActivitySessionGroup[];
  totalDurationSeconds: number;
};

export type ActivitySessionGroup = {
  sessionKey: string;
  label: string;
  urlLabel: string | null;
  blocks: ActivityBlockListRow[];
  totalDurationSeconds: number;
  startedAt: string;
  endedAt: string;
};

export type ActivityDateRange = {
  dateFrom: string;
  dateTo: string;
  rangeStart: string;
  rangeEnd: string;
};

const BROWSER_BUNDLE_FRAGMENTS = [
  'chrome',
  'safari',
  'firefox',
  'brave',
  'edgemac',
  'arc',
  'browser',
];

export function isBrowserActivityBlock(
  block: Pick<ActivityBlockListRow, 'appName' | 'bundleId'>,
): boolean {
  const bundle = block.bundleId.trim().toLowerCase();
  const appName = block.appName.trim().toLowerCase();

  return BROWSER_BUNDLE_FRAGMENTS.some(
    (fragment) => bundle.includes(fragment) || appName.includes(fragment),
  );
}

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
        case 'app': {
          const leftLabel = left.domainLabel ?? left.appName;
          const rightLabel = right.domainLabel ?? right.appName;
          return factor * leftLabel.localeCompare(rightLabel, undefined, {
            sensitivity: 'base',
          });
        }
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

export function resolveActivityDateRange(
  input: {
    from?: string | null;
    to?: string | null;
    range?: string | null;
  },
  now = new Date(),
): ActivityDateRange {
  const fromParam = input.from?.trim();
  const toParam = input.to?.trim();

  if (
    fromParam &&
    toParam &&
    /^\d{4}-\d{2}-\d{2}$/.test(fromParam) &&
    /^\d{4}-\d{2}-\d{2}$/.test(toParam)
  ) {
    const from = startOfDay(parseISO(fromParam));
    const to = endOfDay(parseISO(toParam));

    return {
      dateFrom: fromParam,
      dateTo: toParam,
      rangeStart: from.toISOString(),
      rangeEnd: to.toISOString(),
    };
  }

  const range = parseActivityRange(input.range);
  const from = resolveRangeStart(range, now);
  const to = endOfDay(now);

  return {
    dateFrom: format(from, 'yyyy-MM-dd'),
    dateTo: format(to, 'yyyy-MM-dd'),
    rangeStart: from.toISOString(),
    rangeEnd: to.toISOString(),
  };
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
  const baseKey = bundleId || block.appName.trim().toLowerCase();

  if (isBrowserActivityBlock(block)) {
    const domain = block.domain?.trim().toLowerCase();
    if (domain) {
      return `${baseKey}|${domain}`;
    }
  }

  return baseKey;
}

function domainLabelFromAppKey(appKey: string): string | null {
  const separatorIndex = appKey.indexOf('|');
  if (separatorIndex === -1) {
    return null;
  }

  return appKey.slice(separatorIndex + 1);
}

export function normalizeActivityUrl(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    const path =
      parsed.pathname === '/' ? '' : parsed.pathname.replace(/\/$/, '');
    return `${host}${path}`;
  } catch {
    return null;
  }
}

export function activitySessionGroupKey(block: ActivityBlockListRow): string {
  const url = block.url?.trim();
  if (url) {
    const normalized = normalizeActivityUrl(url);
    if (normalized) {
      return `url:${normalized}`;
    }

    return `url:${url.toLowerCase()}`;
  }

  const domain = block.domain?.trim().toLowerCase();
  if (domain) {
    return `domain:${domain}`;
  }

  const title = block.windowTitle.trim();
  if (title) {
    const primary = title.split(' - ')[0]?.trim() || title;
    return `title:${primary.slice(0, 160).toLowerCase()}`;
  }

  return `app:${block.appName.trim().toLowerCase()}`;
}

export function activitySessionGroupLabel(block: ActivityBlockListRow): string {
  const url = block.url?.trim();
  if (url) {
    const normalized = normalizeActivityUrl(url);
    if (normalized) {
      return normalized;
    }
  }

  if (block.domain?.trim()) {
    return block.domain.trim();
  }

  const title = block.windowTitle.trim();
  if (title) {
    return title.length > 96 ? `${title.slice(0, 93)}…` : title;
  }

  return block.appName;
}

export function groupBlocksBySession(
  blocks: ActivityBlockListRow[],
): ActivitySessionGroup[] {
  const groups = new Map<string, ActivityBlockListRow[]>();
  const labels = new Map<string, string>();

  for (const block of blocks) {
    const sessionKey = activitySessionGroupKey(block);
    const existing = groups.get(sessionKey) ?? [];
    existing.push(block);
    groups.set(sessionKey, existing);

    if (!labels.has(sessionKey)) {
      labels.set(sessionKey, activitySessionGroupLabel(block));
    }
  }

  return [...groups.entries()]
    .map(([sessionKey, sessionBlocks]) => {
      const sortedBlocks = sessionBlocks.sort((left, right) =>
        right.startedAt.localeCompare(left.startedAt),
      );
      const earliest = sortedBlocks.reduce((min, block) =>
        block.startedAt < min ? block.startedAt : min,
      sortedBlocks[0]!.startedAt);
      const latest = sortedBlocks.reduce((max, block) =>
        block.endedAt > max ? block.endedAt : max,
      sortedBlocks[0]!.endedAt);

      return {
        sessionKey,
        label: labels.get(sessionKey) ?? sessionKey,
        urlLabel: blockUrlLabel(sortedBlocks[0]!) ?? null,
        blocks: sortedBlocks,
        totalDurationSeconds: sumActiveDuration(sortedBlocks),
        startedAt: earliest,
        endedAt: latest,
      };
    })
    .sort(
      (left, right) => right.totalDurationSeconds - left.totalDurationSeconds,
    );
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
        appName: appNames.get(appKey) ?? sortedBlocks[0]?.appName ?? appKey,
        domainLabel: domainLabelFromAppKey(appKey),
        blocks: sortedBlocks,
        sessionGroups: groupBlocksBySession(sortedBlocks),
        totalDurationSeconds: sumActiveDuration(sortedBlocks),
      };
    })
    .sort((left, right) => right.totalDurationSeconds - left.totalDurationSeconds);
}

export type ActivityReportRow = {
  id: string;
  label: string;
  durationSeconds: number;
  blockCount: number;
};

export const ACTIVITY_REPORT_UNASSIGNED = '__unassigned__';

const UNASSIGNED_REPORT_ID = ACTIVITY_REPORT_UNASSIGNED;

export function filterActivityBlocksForReport(
  blocks: ActivityBlockListRow[],
  filters: {
    clientId?: string | null;
    projectId?: string | null;
    memberId?: string | null;
    appKey?: string | null;
  },
): ActivityBlockListRow[] {
  return blocks.filter((block) => {
    if (block.isExcluded) {
      return false;
    }

    if (filters.clientId) {
      if (filters.clientId === UNASSIGNED_REPORT_ID) {
        if (block.clientId) return false;
      } else if (block.clientId !== filters.clientId) {
        return false;
      }
    }

    if (filters.projectId) {
      if (filters.projectId === UNASSIGNED_REPORT_ID) {
        if (block.projectId) return false;
      } else if (block.projectId !== filters.projectId) {
        return false;
      }
    }

    if (filters.memberId && block.userId !== filters.memberId) {
      return false;
    }

    if (filters.appKey && activityAppGroupKey(block) !== filters.appKey) {
      return false;
    }

    return true;
  });
}

function aggregateByKey(
  blocks: ActivityBlockListRow[],
  keyForBlock: (block: ActivityBlockListRow) => {
    id: string;
    label: string;
  },
): ActivityReportRow[] {
  const totals = new Map<string, ActivityReportRow>();

  for (const block of blocks) {
    const { id, label } = keyForBlock(block);
    const existing = totals.get(id);

    if (existing) {
      existing.durationSeconds += block.durationSeconds;
      existing.blockCount += 1;
      continue;
    }

    totals.set(id, {
      id,
      label,
      durationSeconds: block.durationSeconds,
      blockCount: 1,
    });
  }

  return [...totals.values()].sort(
    (left, right) => right.durationSeconds - left.durationSeconds,
  );
}

export function aggregateActivityByClient(
  blocks: ActivityBlockListRow[],
): ActivityReportRow[] {
  return aggregateByKey(blocks, (block) => ({
    id: block.clientId ?? UNASSIGNED_REPORT_ID,
    label: block.clientName?.trim() || 'Unassigned',
  }));
}

export function aggregateActivityByProject(
  blocks: ActivityBlockListRow[],
): ActivityReportRow[] {
  return aggregateByKey(blocks, (block) => ({
    id: block.projectId ?? UNASSIGNED_REPORT_ID,
    label: block.projectName?.trim() || 'Unassigned',
  }));
}

export function aggregateActivityByMember(
  blocks: ActivityBlockListRow[],
): ActivityReportRow[] {
  return aggregateByKey(blocks, (block) => ({
    id: block.userId,
    label: block.userName?.trim() || block.userId.slice(0, 8),
  }));
}

export function aggregateActivityByApp(
  blocks: ActivityBlockListRow[],
): ActivityReportRow[] {
  return aggregateByKey(blocks, (block) => {
    const appKey = activityAppGroupKey(block);
    const domainLabel = domainLabelFromAppKey(appKey);

    return {
      id: appKey,
      label: domainLabel ?? block.appName,
    };
  });
}

export type ActivityStatusFilter = 'all' | 'needs_review' | 'unassigned' | 'confirmed';

export function parseActivityStatusFilter(
  value: string | null | undefined,
): ActivityStatusFilter {
  switch (value?.trim()) {
    case 'needs_review':
      return 'needs_review';
    case 'unassigned':
      return 'unassigned';
    case 'confirmed':
      return 'confirmed';
    default:
      return 'all';
  }
}

export function filterBlocksByStatus(
  blocks: ActivityBlockListRow[],
  status: ActivityStatusFilter,
): ActivityBlockListRow[] {
  if (status === 'all') {
    return blocks;
  }

  return blocks.filter((block) => {
    if (block.isExcluded) {
      return false;
    }

    if (status === 'confirmed') {
      return block.isConfirmed;
    }

    if (status === 'unassigned') {
      return !block.isConfirmed && !block.projectId && !block.clientId;
    }

    return !block.isConfirmed;
  });
}

export type ActivityAssignmentSummary = {
  totalActiveSeconds: number;
  totalActiveCount: number;
  unassignedSeconds: number;
  unassignedCount: number;
  needsReviewSeconds: number;
  needsReviewCount: number;
  confirmedSeconds: number;
  confirmedCount: number;
};

export function summarizeActivityAssignment(
  blocks: ActivityBlockListRow[],
): ActivityAssignmentSummary {
  let totalActiveSeconds = 0;
  let totalActiveCount = 0;
  let unassignedSeconds = 0;
  let unassignedCount = 0;
  let needsReviewSeconds = 0;
  let needsReviewCount = 0;
  let confirmedSeconds = 0;
  let confirmedCount = 0;

  for (const block of blocks) {
    if (block.isExcluded) {
      continue;
    }

    totalActiveSeconds += block.durationSeconds;
    totalActiveCount += 1;

    if (block.isConfirmed) {
      confirmedSeconds += block.durationSeconds;
      confirmedCount += 1;
      continue;
    }

    needsReviewSeconds += block.durationSeconds;
    needsReviewCount += 1;

    if (!block.projectId && !block.clientId) {
      unassignedSeconds += block.durationSeconds;
      unassignedCount += 1;
    }
  }

  return {
    totalActiveSeconds,
    totalActiveCount,
    unassignedSeconds,
    unassignedCount,
    needsReviewSeconds,
    needsReviewCount,
    confirmedSeconds,
    confirmedCount,
  };
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
