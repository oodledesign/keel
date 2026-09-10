import type { NameMatchConfidence } from './lookup';

const DATE_RE = /\b(?:due|by)\s*:?\s*(\d{4}-\d{2}-\d{2})\b/i;
const PRIORITY_RE = /\[(low|medium|high|urgent)\]|!(urgent|high)/i;
const CLIENT_LINE_RE = /^(?:client|for)\s*:\s*(.+)$/i;
const PROJECT_LINE_RE = /^project\s*:\s*(.+)$/i;
const BULLET_RE = /^(\s*)(?:[-*•]|\d+[.)])\s+(.+)$/;

export const EXTRACT_TASK_PRIORITIES = [
  'low',
  'medium',
  'high',
  'urgent',
] as const;

export type ExtractTaskPriority = (typeof EXTRACT_TASK_PRIORITIES)[number];

export type ParsedExtractSubtask = {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: ExtractTaskPriority;
};

export type ParsedExtractTask = {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: ExtractTaskPriority;
  suggested_client_name: string | null;
  suggested_project_name: string | null;
  subtasks: ParsedExtractSubtask[];
};

const MAX_TASKS = 50;
const MAX_SUBTASKS = 5;

function normalizePriority(value: string | undefined): ExtractTaskPriority {
  const raw = (value ?? '').trim().toLowerCase();
  if (raw === 'low' || raw === 'medium' || raw === 'high' || raw === 'urgent') {
    return raw;
  }
  return 'medium';
}

function stripDecorators(raw: string): {
  title: string;
  notes: string | null;
  due_date: string | null;
  priority: ExtractTaskPriority;
} {
  let text = raw.trim();
  let due_date: string | null = null;
  let priority: ExtractTaskPriority = 'medium';

  const dueMatch = DATE_RE.exec(text);
  if (dueMatch?.[1]) {
    due_date = dueMatch[1];
    text = text.replace(dueMatch[0], ' ');
  }

  const priorityMatch = PRIORITY_RE.exec(text);
  if (priorityMatch) {
    priority = normalizePriority(priorityMatch[1] ?? priorityMatch[2]);
    text = text.replace(priorityMatch[0], ' ');
  }

  const emDash = text.split(/\s+[—–-]\s+/);
  let notes: string | null = null;
  if (emDash.length > 1) {
    notes = emDash.slice(1).join(' — ').trim() || null;
    text = emDash[0] ?? text;
  }

  return {
    title: text.replace(/\s+/g, ' ').trim(),
    notes,
    due_date,
    priority,
  };
}

function indentLevel(prefix: string): number {
  const expanded = prefix.replace(/\t/g, '  ');
  return Math.floor(expanded.length / 2);
}

/**
 * Parse a chat dump or bullet list into root tasks + optional nested subtasks.
 * Matches the Ozer extract shape (parent + subtasks, optional client/project hints).
 */
export function parseExtractText(text: string): ParsedExtractTask[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const tasks: ParsedExtractTask[] = [];
  let clientHint: string | null = null;
  let projectHint: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.replace(/\s+$/, '');
    if (!line.trim()) {
      continue;
    }

    const clientLine = CLIENT_LINE_RE.exec(line.trim());
    if (clientLine?.[1]) {
      clientHint = clientLine[1].trim() || null;
      continue;
    }

    const projectLine = PROJECT_LINE_RE.exec(line.trim());
    if (projectLine?.[1]) {
      projectHint = projectLine[1].trim() || null;
      continue;
    }

    const bullet = BULLET_RE.exec(line);
    if (!bullet) {
      if (tasks.length === 0 && line.trim().length > 1) {
        const parsed = stripDecorators(line.trim());
        if (parsed.title) {
          tasks.push({
            ...parsed,
            suggested_client_name: clientHint,
            suggested_project_name: projectHint,
            subtasks: [],
          });
        }
      }
      continue;
    }

    const level = indentLevel(bullet[1] ?? '');
    const parsed = stripDecorators(bullet[2] ?? '');
    if (!parsed.title) {
      continue;
    }

    if (level > 0 && tasks.length > 0) {
      const parent = tasks[tasks.length - 1];
      if (parent && parent.subtasks.length < MAX_SUBTASKS) {
        parent.subtasks.push({
          title: parsed.title,
          notes: parsed.notes,
          due_date: parsed.due_date,
          priority: parsed.priority,
        });
      }
      continue;
    }

    if (tasks.length >= MAX_TASKS) {
      break;
    }

    tasks.push({
      ...parsed,
      suggested_client_name: clientHint,
      suggested_project_name: projectHint,
      subtasks: [],
    });
  }

  return tasks;
}

export function shouldAutoLink(input: {
  explicitId?: string;
  confidence?: NameMatchConfidence | null;
  acceptSuggestions: boolean;
}): boolean {
  if (input.explicitId) {
    return true;
  }

  if (input.confidence === 'high') {
    return true;
  }

  return input.confidence === 'medium' && input.acceptSuggestions;
}
