import 'server-only';

import { z } from 'zod';

import {
  normalizeAiExtractedDueDateYmd,
  todayLocalYmd,
} from '~/home/_lib/due-date-ymd';

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
};

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

/**
 * Calls Anthropic Messages API. Requires `ANTHROPIC_API_KEY`.
 * Model: `ANTHROPIC_TASK_EXTRACT_MODEL` or `ANTHROPIC_MODEL` or default `claude-haiku-4-5`.
 */
export async function extractWorkspaceTasksWithAnthropic(
  rawText: string,
  context: WorkspaceContextForExtract,
  instructions?: string | null,
): Promise<ExtractedWorkspaceTaskDraft[]> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set. Add it to your environment to use AI task extraction.',
    );
  }

  const model =
    process.env.ANTHROPIC_TASK_EXTRACT_MODEL?.trim() ||
    process.env.ANTHROPIC_MODEL?.trim() ||
    'claude-haiku-4-5';

  const projectLines = context.projects
    .map((p) => `- "${p.name}" (id: ${p.id})`)
    .join('\n');
  const clientLines = context.clients
    .map((c) => `- "${c.name}" (id: ${c.id})`)
    .join('\n');

  const meetingClientLine = context.meetingClient
    ? `\nMeeting context: this transcript is for client "${context.meetingClient.name}" (id: ${context.meetingClient.id}). Link all extracted tasks to this client unless the text clearly concerns a different client or project.\n`
    : '';

  const todayLocal = todayLocalYmd();
  const currentYearStr = todayLocal.slice(0, 4);
  const nextYearStr = String(Number(currentYearStr) + 1);

  const system = `You extract actionable tasks from business emails or meeting transcripts.
Return ONLY valid JSON matching this shape (no markdown fences):
{
  "items": [
    {
      "title": "string",
      "notes": "string or null — context from the source for this parent task",
      "due_date": "YYYY-MM-DD or null — infer reasonable deadlines from dates mentioned; use null if unknown",
      "priority": "low" | "medium" | "high" | "urgent",
      "suggested_project_name": "string or null — best matching name from the project list, or null",
      "suggested_client_name": "string or null — best matching name from the client list, or null",
      "subtasks": [
        { "title": "string", "notes": "string or null", "due_date": "YYYY-MM-DD or null", "priority": "low"|"medium"|"high"|"urgent" }
      ]
    }
  ]
}
Rules:
- Group related actions: one parent task with concrete subtasks when the source implies a checklist or phases.
- Each parent should have a clear title; subtasks are smaller steps.
- Prefer project OR client suggestion when the text clearly references one; use null when unclear.
- Dates: only ISO strings YYYY-MM-DD or null.
- Calendar context: today is ${todayLocal} (local). For actionable due dates, use year ${currentYearStr} or a later year when the source implies a future deadline. If the text gives month/day (or "June 20", "20/6") without a year, assume the next occurrence on or after today — almost always ${currentYearStr} or ${nextYearStr}. Do not use 2023, 2024, or other past years unless the source explicitly names that year for a historical reference (then prefer null for due_date if it is not an actionable deadline).`;

  const userContent = `Today (for interpreting relative deadlines): ${todayLocal}
${meetingClientLine}${formatExtractInstructionsBlock(instructions)}
Workspace projects (choose names that best match the text; we map to ids server-side):\n${projectLines || '(none)'}\n\nWorkspace clients:\n${clientLines || '(none)'}\n\n---\nSOURCE TEXT:\n${rawText}\n---\nRespond with JSON only.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      system,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(
      `Anthropic API error (${res.status}): ${errText.slice(0, 400)}`,
    );
  }

  const body = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  const textBlock = body.content?.find((c) => c.type === 'text');
  const raw = textBlock?.text?.trim();
  if (!raw) {
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
    dueDate: normalizeAiExtractedDueDateYmd(item.due_date?.trim() || null),
    priority: normalizePriority(item.priority),
    suggestedProjectName: item.suggested_project_name?.trim() || null,
    suggestedClientName: item.suggested_client_name?.trim() || null,
    subtasks: (item.subtasks ?? []).map((s) => ({
      title: s.title.trim(),
      notes: s.notes?.trim() || null,
      dueDate: normalizeAiExtractedDueDateYmd(s.due_date?.trim() || null),
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
  const projectId = mapNameToId(
    draft.suggestedProjectName,
    context.projects,
  );
  const clientId = mapNameToId(
    draft.suggestedClientName,
    context.clients,
  );
  return { projectId, clientId };
}
