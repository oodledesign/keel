import type { TasksPageTask } from '~/home/(user)/_lib/server/tasks.loader';

export type TaskExportRow = {
  title: string;
  description: string;
  status: string;
  priority: string;
  dueDate: string;
  client: string;
  project: string;
  assignee: string;
  workspace: string;
  area: string;
  source: string;
  /** Nesting depth for plain text / markdown (0 = root). */
  depth: number;
};

const STATUS_LABELS: Record<TasksPageTask['status'], string> = {
  pending: 'Not started',
  in_progress: 'In progress',
  client_review: 'Client review',
  completed: 'Completed',
};

const PRIORITY_LABELS: Record<TasksPageTask['priority'], string> = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
};

const SOURCE_LABELS: Record<TasksPageTask['source'], string> = {
  manual: 'Manual',
  meeting: 'Meeting',
  email: 'Email',
};

function cell(value: string | null | undefined): string {
  const trimmed = (value ?? '').trim();
  return trimmed || '—';
}

function mapTaskToRow(task: TasksPageTask, depth: number): TaskExportRow {
  return {
    title: task.title.trim() || 'Untitled',
    description: (task.notes ?? '').trim(),
    status: STATUS_LABELS[task.status] ?? task.status,
    priority: PRIORITY_LABELS[task.priority] ?? task.priority,
    dueDate: cell(task.dueDateLabel || task.dueDate),
    client: cell(task.clientName),
    project: cell(task.projectName),
    assignee: cell(task.assigneeName),
    workspace: cell(task.workspaceName),
    area: cell(task.areaLabel),
    source: SOURCE_LABELS[task.source] ?? task.source,
    depth,
  };
}

/** Flatten the current filtered tree (roots + nested subtasks). */
export function flattenTasksForExport(
  tasks: TasksPageTask[],
  depth = 0,
): TaskExportRow[] {
  const rows: TaskExportRow[] = [];
  for (const task of tasks) {
    rows.push(mapTaskToRow(task, depth));
    if (task.subtasks?.length) {
      rows.push(...flattenTasksForExport(task.subtasks, depth + 1));
    }
  }
  return rows;
}

export type ScheduledSeriesExportInput = {
  title: string;
  frequency: string;
  status: string;
  nextCreateYmd: string;
  dueDays: number;
  priority: string;
  notes: string | null;
};

export function flattenScheduledSeriesForExport(
  series: ScheduledSeriesExportInput[],
): TaskExportRow[] {
  return series.map((item) => ({
    title: item.title.trim() || 'Untitled',
    description: (item.notes ?? '').trim(),
    status:
      item.status === 'paused'
        ? 'Paused'
        : item.status === 'ended'
          ? 'Ended'
          : 'Active',
    priority:
      PRIORITY_LABELS[item.priority as TasksPageTask['priority']] ??
      item.priority,
    dueDate: `Next ${item.nextCreateYmd} · due +${item.dueDays}d`,
    client: '—',
    project: '—',
    assignee: '—',
    workspace: '—',
    area: '—',
    source: `Recurring (${item.frequency})`,
    depth: 0,
  }));
}

const CSV_HEADERS = [
  'Title',
  'Description',
  'Status',
  'Priority',
  'Due date',
  'Client',
  'Project',
  'Assignee',
  'Workspace',
  'Area',
  'Source',
] as const;

function escapeCsvCell(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export function tasksToCsv(rows: TaskExportRow[]): string {
  const lines = [
    CSV_HEADERS.join(','),
    ...rows.map((row) =>
      [
        escapeCsvCell(
          row.depth > 0 ? `${'  '.repeat(row.depth)}${row.title}` : row.title,
        ),
        escapeCsvCell(row.description),
        escapeCsvCell(row.status),
        escapeCsvCell(row.priority),
        escapeCsvCell(row.dueDate),
        escapeCsvCell(row.client),
        escapeCsvCell(row.project),
        escapeCsvCell(row.assignee),
        escapeCsvCell(row.workspace),
        escapeCsvCell(row.area),
        escapeCsvCell(row.source),
      ].join(','),
    ),
  ];
  // BOM + CRLF so Excel (esp. Windows) opens UTF-8 correctly.
  return `\uFEFF${lines.join('\r\n')}\r\n`;
}

export function tasksToPlainText(rows: TaskExportRow[]): string {
  if (rows.length === 0) return 'No tasks in the current view.';

  return rows
    .map((row) => {
      const indent = '  '.repeat(row.depth);
      const lines = [
        `${indent}${row.title}`,
        `${indent}Status: ${row.status} · Priority: ${row.priority} · Due: ${row.dueDate}`,
        `${indent}Client: ${row.client} · Project: ${row.project} · Assignee: ${row.assignee}`,
      ];
      if (row.workspace !== '—') {
        lines.push(`${indent}Workspace: ${row.workspace}`);
      }
      if (row.area !== '—') {
        lines.push(`${indent}Area: ${row.area}`);
      }
      if (row.source !== '—') {
        lines.push(`${indent}Source: ${row.source}`);
      }
      if (row.description) {
        lines.push(`${indent}${row.description}`);
      }
      return lines.join('\n');
    })
    .join('\n\n');
}

export function tasksToMarkdown(rows: TaskExportRow[]): string {
  if (rows.length === 0) return '_No tasks in the current view._';

  const lines: string[] = [
    '| Title | Description | Status | Priority | Due date | Client | Project | Assignee | Workspace | Area | Source |',
    '| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |',
  ];

  for (const row of rows) {
    const title =
      row.depth > 0
        ? `${' '.repeat(row.depth)}↳ ${escapeMdCell(row.title)}`
        : escapeMdCell(row.title);
    lines.push(
      `| ${title} | ${escapeMdCell(row.description || '—')} | ${escapeMdCell(row.status)} | ${escapeMdCell(row.priority)} | ${escapeMdCell(row.dueDate)} | ${escapeMdCell(row.client)} | ${escapeMdCell(row.project)} | ${escapeMdCell(row.assignee)} | ${escapeMdCell(row.workspace)} | ${escapeMdCell(row.area)} | ${escapeMdCell(row.source)} |`,
    );
  }

  return `${lines.join('\n')}\n`;
}

function escapeMdCell(value: string): string {
  return value.replace(/\|/g, '\\|').replace(/\n/g, ' ');
}

export function downloadTextFile(
  filename: string,
  content: string,
  mimeType: string,
): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  // Defer revoke — some browsers start the download asynchronously after click.
  setTimeout(() => URL.revokeObjectURL(url), 100);
}

export function exportFilename(prefix: string, extension: string): string {
  const stamp = new Date().toISOString().slice(0, 10);
  return `${prefix}-${stamp}.${extension}`;
}
