import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import {
  normalizeAiExtractedDueDateYmd,
  toIsoDateString,
  todayLocalYmd,
} from '~/home/_lib/due-date-ymd';
import { callAI } from '~/lib/ai/router';

import { formatExtractInstructionsBlock } from './extract-instructions';

const AnthropicSubtaskSchema = z.object({
  title: z.string(),
  notes: z.string().optional().nullable(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
});

const AnthropicParentSchema = z.object({
  title: z.string(),
  notes: z.string().optional().nullable(),
  due_date: z.string().nullable().optional(),
  priority: z.enum(['low', 'medium', 'high', 'urgent']).optional(),
  suggested_project_name: z.string().nullable().optional(),
  suggested_client_name: z.string().nullable().optional(),
  suggested_assignee_kind: z.enum(['member', 'contact']).nullable().optional(),
  suggested_assignee_email: z.string().nullable().optional(),
  suggested_assignee_name: z.string().nullable().optional(),
  subtasks: z.array(AnthropicSubtaskSchema).default([]),
});

const AnthropicExtractSchema = z.object({
  items: z.array(AnthropicParentSchema),
});

export type ExtractedWorkspaceTaskDraft = {
  title: string;
  notes: string | null;
  dueDate: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  suggestedProjectName: string | null;
  suggestedClientName: string | null;
  suggestedAssigneeKind: 'member' | 'contact' | null;
  suggestedAssigneeEmail: string | null;
  suggestedAssigneeName: string | null;
  subtasks: Array<{
    title: string;
    notes: string | null;
    dueDate: string | null;
    priority: 'low' | 'medium' | 'high' | 'urgent';
  }>;
};

export type WorkspaceContextForExtract = {
  projects: Array<{ id: string; name: string }>;
  clients: Array<{ id: string; name: string }>;
  /** When set, the source is a meeting linked to this client. */
  meetingClient?: { id: string; name: string } | null;
  /**
   * Calendar day of the call/meeting (YYYY-MM-DD). Used as the reference
   * “today” for relative deadlines mentioned in the transcript.
   */
  meetingDateYmd?: string | null;
  /** Calendar attendees from the meeting invite. */
  attendees?: Array<{ name: string | null; email: string | null }>;
  /** Workspace team members who can be assignees. */
  members?: Array<{ name: string | null; email: string }>;
  /** CRM contacts who can be assignees (often for the meeting client). */
  contacts?: Array<{ name: string; email: string | null }>;
};

function pad2(n: number) {
  return String(n).padStart(2, '0');
}

function ymdFromLocalDate(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function parseYmdToLocalDate(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const date = new Date(y, mo - 1, d, 12, 0, 0, 0);
  if (
    date.getFullYear() !== y ||
    date.getMonth() !== mo - 1 ||
    date.getDate() !== d
  ) {
    return null;
  }
  return date;
}

/** Next weekday after `startYmd` by `businessDays` (Mon–Fri). */
export function addBusinessDaysYmd(
  startYmd: string,
  businessDays: number,
): string | null {
  const start = parseYmdToLocalDate(startYmd);
  if (!start || businessDays < 0) return null;
  const cursor = new Date(start);
  let remaining = businessDays;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() + 1);
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) remaining -= 1;
  }
  return ymdFromLocalDate(cursor);
}

/**
 * Prefer an AI-inferred deadline; otherwise default to two business days
 * after the meeting (or after today when no meeting date is available).
 */
export function resolveExtractedDueDate(input: {
  aiDueDate: string | null;
  meetingDateYmd?: string | null;
  now?: Date;
}): string | null {
  const now = input.now ?? new Date();
  const reference = toIsoDateString(input.meetingDateYmd) ?? todayLocalYmd(now);
  const refDate = parseYmdToLocalDate(reference) ?? now;

  const normalized = normalizeAiExtractedDueDateYmd(input.aiDueDate, refDate);
  if (normalized) return normalized;

  return addBusinessDaysYmd(reference, 2);
}

function normalizePriority(
  v: string | undefined,
): 'low' | 'medium' | 'high' | 'urgent' {
  const t = (v ?? '').trim().toLowerCase();
  if (t === 'normal' || t === 'default') return 'medium';
  if (t === 'low' || t === 'medium' || t === 'high' || t === 'urgent') return t;
  return 'medium';
}

function mapNameToId(
  name: string | null | undefined,
  rows: Array<{ id: string; name: string }>,
): string | null {
  if (!name?.trim()) return null;
  const t = name.trim().toLowerCase();
  const exact = rows.find((r) => r.name.trim().toLowerCase() === t);
  if (exact) return exact.id;
  const partial = rows.find((r) => {
    const n = r.name.trim().toLowerCase();
    return n.includes(t) || t.includes(n);
  });
  return partial?.id ?? null;
}

export async function extractWorkspaceTasksWithAnthropic(
  rawText: string,
  context: WorkspaceContextForExtract,
  instructions: string | null | undefined,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<ExtractedWorkspaceTaskDraft[]> {
  const projectLines = context.projects
    .map((p) => `- "${p.name}" (id: ${p.id})`)
    .join('\n');
  const clientLines = context.clients
    .map((c) => `- "${c.name}" (id: ${c.id})`)
    .join('\n');

  const meetingClientLine = context.meetingClient
    ? `\nMeeting context: this transcript is for client "${context.meetingClient.name}" (id: ${context.meetingClient.id}). Link all extracted tasks to this client unless the text clearly concerns a different client or project.\n`
    : '';

  const attendeeLines = (context.attendees ?? [])
    .map((a) => {
      const name = a.name?.trim() || '(no name)';
      const email = a.email?.trim() || '(no email)';
      return `- ${name} <${email}>`;
    })
    .join('\n');
  const memberLines = (context.members ?? [])
    .map((m) => `- ${m.name?.trim() || m.email} <${m.email}> [member]`)
    .join('\n');
  const contactLines = (context.contacts ?? [])
    .map(
      (c) =>
        `- ${c.name}${c.email ? ` <${c.email}>` : ''} [contact]`,
    )
    .join('\n');

  const meetingDateYmd =
    toIsoDateString(context.meetingDateYmd) ?? todayLocalYmd();
  const meetingRefDate = parseYmdToLocalDate(meetingDateYmd) ?? new Date();
  const currentYearStr = meetingDateYmd.slice(0, 4);
  const nextYearStr = String(Number(currentYearStr) + 1);

  const system = `You extract actionable tasks from business emails or meeting transcripts.
Return ONLY valid JSON matching this shape (no markdown fences):
{
  "items": [
    {
      "title": "string",
      "notes": "string or null — context from the source for this parent task",
      "due_date": "YYYY-MM-DD or null — infer deadlines from dates spoken in the call; use null only when no deadline is implied",
      "priority": "low" | "medium" | "high" | "urgent",
      "suggested_project_name": "string or null — best matching name from the project list, or null",
      "suggested_client_name": "string or null — best matching name from the client list, or null",
      "suggested_assignee_kind": "member" | "contact" | null,
      "suggested_assignee_email": "string or null — email from the people lists when known",
      "suggested_assignee_name": "string or null — display name from the people lists",
      "subtasks": [
        { "title": "string", "notes": "string or null", "due_date": "YYYY-MM-DD or null", "priority": "low"|"medium"|"high"|"urgent" }
      ]
    }
  ]
}
Rules:
- Default to flat tasks with an empty "subtasks" array. Prefer one clear parent task with notes over a checklist of subtasks.
- Only add subtasks when the source clearly requires distinct sequential steps that would be incomplete if left as a single task (e.g. “draft → review → send”, or separate owners/deadlines per step). Do not invent phases or break a simple action into subtasks.
- Never create a subtask that merely restates the parent. Cap at 3 subtasks on a parent when they are warranted; otherwise use [].
- Each parent should have a clear title; put supporting context in notes, not as subtasks.
- Prefer project OR client suggestion when the text clearly references one; use null when unclear.
- Assignee: only set suggested_assignee_* when the source clearly makes someone responsible (e.g. “Sarah will send…”, “Can you pick this up, Dan?”). Prefer matching calendar attendees and the people lists. Use kind "member" for team, "contact" for client contacts. Never invent people; use nulls when unclear.
- Dates: only ISO strings YYYY-MM-DD or null.
- Calendar context: the call/meeting took place on ${meetingDateYmd} (local). Treat that day as “today” for relative phrases in the transcript (“tomorrow”, “Friday”, “next week”, “end of week”, “in two days”). Prefer concrete deadlines mentioned in the conversation over inventing dates.
- For actionable due dates, use year ${currentYearStr} or a later year when the source implies a future deadline. If the text gives month/day (or "June 20", "20/6") without a year, assume the next occurrence on or after ${meetingDateYmd} — almost always ${currentYearStr} or ${nextYearStr}. Do not use past years unless the source explicitly names that year for a historical reference (then prefer null for due_date if it is not an actionable deadline).`;

  const userContent = `Meeting / reference date (for interpreting relative deadlines): ${meetingDateYmd}
${meetingClientLine}${formatExtractInstructionsBlock(instructions)}
Workspace projects (choose names that best match the text; we map to ids server-side):\n${projectLines || '(none)'}\n\nWorkspace clients:\n${clientLines || '(none)'}\n\nCalendar attendees:\n${attendeeLines || '(none)'}\n\nTeam members (assignees):\n${memberLines || '(none)'}\n\nClient contacts (assignees):\n${contactLines || '(none)'}\n\n---\nSOURCE TEXT:\n${rawText}\n---\nRespond with JSON only.`;

  const raw = await callAI({
    feature: 'workspace_task_extract',
    systemPrompt: system,
    userPrompt: userContent,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });
  if (!raw?.trim()) {
    throw new Error('Empty response from Anthropic');
  }

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start >= 0 && end > start) {
      json = JSON.parse(raw.slice(start, end + 1));
    } else {
      throw new Error('Model did not return parseable JSON');
    }
  }

  const parsed = AnthropicExtractSchema.parse(json);

  return parsed.items.map((item) => ({
    title: item.title.trim(),
    notes: item.notes?.trim() || null,
    dueDate: resolveExtractedDueDate({
      aiDueDate: item.due_date?.trim() || null,
      meetingDateYmd,
      now: meetingRefDate,
    }),
    priority: normalizePriority(item.priority),
    suggestedProjectName: item.suggested_project_name?.trim() || null,
    suggestedClientName: item.suggested_client_name?.trim() || null,
    suggestedAssigneeKind: item.suggested_assignee_kind ?? null,
    suggestedAssigneeEmail: item.suggested_assignee_email?.trim() || null,
    suggestedAssigneeName: item.suggested_assignee_name?.trim() || null,
    subtasks: (item.subtasks ?? []).map((s) => ({
      title: s.title.trim(),
      notes: s.notes?.trim() || null,
      dueDate: resolveExtractedDueDate({
        aiDueDate: s.due_date?.trim() || null,
        meetingDateYmd,
        now: meetingRefDate,
      }),
      priority: normalizePriority(s.priority),
    })),
  }));
}

export function resolveDraftAssignment(
  draft: ExtractedWorkspaceTaskDraft,
  context: WorkspaceContextForExtract,
): {
  projectId: string | null;
  clientId: string | null;
} {
  const projectId = mapNameToId(draft.suggestedProjectName, context.projects);
  const clientId = mapNameToId(draft.suggestedClientName, context.clients);
  return { projectId, clientId };
}
