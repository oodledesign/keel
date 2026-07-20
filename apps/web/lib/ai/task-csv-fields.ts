import {
  CSV_SKIP_FIELD,
  type CsvFieldMapping,
} from '~/lib/csv/rows-to-records';

export const TASK_CSV_FIELDS = [
  'title',
  'notes',
  'due_date',
  'priority',
  'status',
  'client_name',
  'project_name',
] as const;

export type TaskCsvField = (typeof TASK_CSV_FIELDS)[number];

export const TASK_CSV_FIELD_OPTIONS: Array<{
  value: TaskCsvField | typeof CSV_SKIP_FIELD;
  label: string;
}> = [
  { value: CSV_SKIP_FIELD, label: "Don't import" },
  { value: 'title', label: 'Title (required)' },
  { value: 'notes', label: 'Notes / description' },
  { value: 'due_date', label: 'Due date' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'client_name', label: 'Client name' },
  { value: 'project_name', label: 'Project name' },
];

export type TaskCsvMapResult = {
  mapping: CsvFieldMapping;
  confidence: 'high' | 'medium' | 'low';
  notes?: string;
  aiUsed: boolean;
};

const FIELD_SET = new Set<string>(TASK_CSV_FIELDS);

export function normalizeTaskCsvMapping(
  headers: string[],
  mapping: CsvFieldMapping | undefined,
): CsvFieldMapping {
  const out: CsvFieldMapping = {};
  const used = new Set<string>();

  for (const header of headers) {
    const raw = mapping?.[header]?.trim() || CSV_SKIP_FIELD;
    if (raw === CSV_SKIP_FIELD || !FIELD_SET.has(raw) || used.has(raw)) {
      out[header] = CSV_SKIP_FIELD;
      continue;
    }
    out[header] = raw;
    used.add(raw);
  }

  return out;
}

export function heuristicTaskMapping(
  headers: string[],
): Omit<TaskCsvMapResult, 'aiUsed'> {
  const lower = headers.map((h) => h.toLowerCase());
  const mapping: CsvFieldMapping = Object.fromEntries(
    headers.map((h) => [h, CSV_SKIP_FIELD]),
  );
  const used = new Set<string>();

  const assign = (field: TaskCsvField, ...candidates: string[]) => {
    if (used.has(field)) return;
    for (const c of candidates) {
      const i = lower.findIndex((h) => h === c || h.includes(c));
      if (i >= 0 && mapping[headers[i]!] === CSV_SKIP_FIELD) {
        mapping[headers[i]!] = field;
        used.add(field);
        return;
      }
    }
  };

  assign('title', 'title', 'task', 'subject', 'name');
  assign('notes', 'notes', 'description', 'details', 'body');
  assign('due_date', 'due date', 'due', 'deadline');
  assign('priority', 'priority', 'urgency');
  assign('status', 'status', 'state');
  assign('client_name', 'client', 'customer', 'company');
  assign('project_name', 'project', 'job', 'campaign');

  if (!used.has('title') && headers[0]) {
    mapping[headers[0]] = 'title';
  }

  return {
    mapping,
    confidence: 'medium',
    notes: 'Heuristic mapping (AI unavailable)',
  };
}
