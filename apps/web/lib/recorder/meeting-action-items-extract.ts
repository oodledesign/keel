import 'server-only';

import { z } from 'zod';

import type { ExtractAccountMember } from '@kit/email-assistant';
import { parseExtractResponse, stripJsonFences } from '@kit/email-assistant';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

const MAX_TRANSCRIPT_CHARS = 80_000;
const MIN_TASK_CONFIDENCE = 0.45;

const MeetingExtractItemSchema = z.object({
  suggested_title: z.string().optional(),
  suggested_description: z.string().nullable().optional(),
  suggested_due_date: z.string().nullable().optional(),
  source_excerpt: z.string().nullable().optional(),
  task_confidence: z.number().nullable().optional(),
  assignee_confidence: z.number().nullable().optional(),
  suggested_assignee_email: z.string().nullable().optional(),
  title: z.string().optional(),
  detail: z.string().nullable().optional(),
});

const MeetingExtractResponseSchema = z.object({
  items: z.array(MeetingExtractItemSchema),
});

export type MeetingExtractedActionItem = {
  suggestedTitle: string;
  suggestedDescription: string | null;
  suggestedDueDate: string | null;
  sourceExcerpt: string | null;
  taskConfidence: number | null;
  assigneeConfidence: number | null;
  suggestedAssigneeEmail: string | null;
};

export type MeetingActionItemExtractInput = {
  title: string;
  transcript: string;
  summaryText: string | null;
  meetingDate?: string | null;
  recorderName: string | null;
  recorderEmail: string;
  accountMembers: ExtractAccountMember[];
  calendarAttendees?: Array<{ name: string; email: string }>;
};

const EXTRACT_SYSTEM = `You extract explicit action items from a meeting transcript for a human review queue.
Return ONLY valid JSON, no prose, no markdown fences:
{
  "items": [
    {
      "suggested_title": string,
      "suggested_description": string|null,
      "suggested_due_date": "YYYY-MM-DD"|null,
      "source_excerpt": string,
      "task_confidence": number,
      "assignee_confidence": number,
      "suggested_assignee_email": string|null
    }
  ]
}

Rules:
- Only include explicit action items — commitments to do something, not discussion topics or FYIs.
- Use [] when there are no actionable items.
- Infer due dates from phrases like "by Friday" using the provided current date; use null when unknown.
- Keep suggested_title short and imperative; put supporting context in suggested_description.
- source_excerpt: verbatim quote from the transcript supporting this task (max ~200 characters).
- task_confidence is 0-1 for how clearly this is a real, actionable commitment (not a vague idea).
- assignee_confidence is 0-1 for how confident you are in suggested_assignee_email.

Assignee rules (critical):
- The meeting recorder (primary user) is identified in the user message. Account members (name + email) are listed when available.
- Only assign when there is explicit evidence in the transcript (direct address, "I'll…", "Sarah will send…", accepted commitment).
- Do NOT assign to the recorder just because they attended or recorded the call.
- If assignment is ambiguous, set suggested_assignee_email to null, assignee_confidence below 0.6, and keep the item for review.
- Never guess an assignee to avoid leaving tasks unassigned.
- If the source clearly assigns work to a named account member, set suggested_assignee_email to that member's email.
- If the source assigns work to someone who is not an account member, omit the item entirely.
- When suggested_assignee_email is null, assignee_confidence must be at most 0.5.`;

function buildMemberList(members: ExtractAccountMember[]): string {
  if (members.length === 0) {
    return 'Account members: (none linked — only surface tasks with explicit evidence for the recorder)';
  }

  const lines = members.map((member) => {
    const label = member.name?.trim() || member.email;
    return `- ${label} <${member.email}>`;
  });

  return `Account members:\n${lines.join('\n')}`;
}

function formatAttendeeList(
  attendees: Array<{ name: string; email: string }> | undefined,
): string {
  if (!attendees?.length) {
    return 'Calendar attendees: (not available)';
  }

  const lines = attendees
    .filter((attendee) => attendee.email.trim())
    .map((attendee) => {
      const name = attendee.name.trim() || attendee.email.trim();
      return `- ${name} <${attendee.email.trim()}>`;
    });

  if (lines.length === 0) {
    return 'Calendar attendees: (not available)';
  }

  return `Calendar attendees:\n${lines.join('\n')}`;
}

function normalizeDueDate(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return null;
  }
  return trimmed;
}

function normalizeConfidence(value: number | null | undefined): number | null {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }

  const clamped = Math.min(1, Math.max(0, value));
  return Math.round(clamped * 1000) / 1000;
}

function normalizeExcerpt(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }
  return trimmed.length > 200 ? `${trimmed.slice(0, 197)}…` : trimmed;
}

export function parseMeetingExtractResponse(
  raw: string,
): MeetingExtractedActionItem[] {
  const cleaned = stripJsonFences(raw);

  let json: unknown;

  try {
    json = JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf('{');
    const end = cleaned.lastIndexOf('}');

    if (start < 0 || end <= start) {
      return parseExtractResponse(raw).map((item) => ({
        suggestedTitle: item.title,
        suggestedDescription: item.detail,
        suggestedDueDate: item.suggestedDueDate,
        sourceExcerpt: item.sourceExcerpt,
        taskConfidence: null,
        assigneeConfidence: item.assigneeConfidence,
        suggestedAssigneeEmail: item.suggestedAssigneeEmail,
      }));
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }

  const parsed = MeetingExtractResponseSchema.safeParse(json);

  if (!parsed.success) {
    return parseExtractResponse(raw).map((item) => ({
      suggestedTitle: item.title,
      suggestedDescription: item.detail,
      suggestedDueDate: item.suggestedDueDate,
      sourceExcerpt: item.sourceExcerpt,
      taskConfidence: null,
      assigneeConfidence: item.assigneeConfidence,
      suggestedAssigneeEmail: item.suggestedAssigneeEmail,
    }));
  }

  return parsed.data.items
    .map((item) => {
      const title = (item.suggested_title ?? item.title ?? '').trim();
      const description =
        item.suggested_description?.trim() || item.detail?.trim() || null;

      return {
        suggestedTitle: title,
        suggestedDescription: description,
        suggestedDueDate: normalizeDueDate(item.suggested_due_date),
        sourceExcerpt: normalizeExcerpt(item.source_excerpt),
        taskConfidence: normalizeConfidence(item.task_confidence),
        assigneeConfidence: normalizeConfidence(item.assignee_confidence),
        suggestedAssigneeEmail:
          item.suggested_assignee_email?.trim().toLowerCase() || null,
      };
    })
    .filter(
      (item) =>
        item.suggestedTitle.length > 0 &&
        (item.taskConfidence === null ||
          item.taskConfidence >= MIN_TASK_CONFIDENCE),
    );
}

export async function extractMeetingActionItems(
  input: MeetingActionItemExtractInput,
): Promise<MeetingExtractedActionItem[]> {
  const transcript = input.transcript.trim();
  const summary = input.summaryText?.trim() || null;

  if (!transcript && !summary) {
    return [];
  }

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const model = resolveAnthropicModel();
  const currentDate = todayLocalYmd();
  const recorderLabel = input.recorderName?.trim()
    ? `${input.recorderName.trim()} <${input.recorderEmail}>`
    : input.recorderEmail;

  const userContent = `Current date: ${currentDate}

Meeting title: ${input.title.trim() || 'Meeting'}
Meeting date: ${input.meetingDate?.trim() || 'Unknown date'}

Meeting recorder (primary user): ${recorderLabel}

${buildMemberList(input.accountMembers)}

${formatAttendeeList(input.calendarAttendees)}

Meeting summary (use for speaker attribution and context):
---
${summary || '(Summary unavailable — rely on transcript)'}
---

Full transcript:
---
${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}
---

Respond with JSON only.`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: EXTRACT_SYSTEM,
      messages: [{ role: 'user', content: userContent }],
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Anthropic API error (${response.status}): ${(await response.text()).slice(0, 400)}`,
    );
  }

  const body = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };

  const raw = body.content
    ?.find((block) => block.type === 'text')
    ?.text?.trim();
  if (!raw) {
    throw new Error('Empty extraction response from Anthropic');
  }

  return parseMeetingExtractResponse(raw);
}
