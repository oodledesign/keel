import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { z } from 'zod';

import type { ExtractAccountMember } from '@kit/email-assistant';
import {
  normalizeDurationMinutes,
  parseExtractResponse,
  stripJsonFences,
} from '@kit/email-assistant';

import { todayLocalYmd } from '~/home/_lib/due-date-ymd';
import { callAI } from '~/lib/ai/router';

const MAX_TRANSCRIPT_CHARS = 80_000;
const MIN_TASK_CONFIDENCE = 0.45;
/** Skip the extract model call when the transcript is too thin to hold commitments. */
export const MIN_TRANSCRIPT_CHARS_FOR_TASK_EXTRACTION = 120;

const MeetingExtractItemSchema = z.object({
  suggested_title: z.string().optional(),
  suggested_description: z.string().nullable().optional(),
  suggested_due_date: z.string().nullable().optional(),
  suggested_duration_minutes: z
    .union([z.number(), z.string()])
    .nullable()
    .optional(),
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
  suggestedDurationMinutes: number | null;
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
  accountId: string;
  supabase: SupabaseClient;
};

const EXTRACT_SYSTEM = `You extract explicit action items from a meeting transcript for a human review queue.
Meetings are often agency/client design or project calls (deliverables, approvals, assets, timelines).
Return ONLY valid JSON, no prose, no markdown fences:
{
  "items": [
    {
      "suggested_title": string,
      "suggested_description": string|null,
      "suggested_due_date": "YYYY-MM-DD"|null,
      "suggested_duration_minutes": number|null,
      "source_excerpt": string,
      "task_confidence": number,
      "assignee_confidence": number,
      "suggested_assignee_email": string|null
    }
  ]
}

Rules:
- Only include explicit action items — commitments to do something, not discussion topics or FYIs.
- Prefer concrete follow-ups: send/revise a deliverable, share assets, approve comps, schedule a next call, update a brief, chase a dependency.
- Use [] when there are no actionable items.
- Deduplicate: if two lines describe the same commitment, keep the first item.
- Infer due dates from phrases like "by Friday" using the provided current date; use null when unknown.
- Infer suggested_duration_minutes only when the transcript mentions effort (e.g. "30 mins", "2 hours"). Use an integer number of minutes. Use null when no duration is mentioned — do not guess.
- Keep suggested_title short and imperative; put supporting context in suggested_description.
- source_excerpt: verbatim quote from the transcript supporting this task (max ~200 characters).
- task_confidence is 0-1 for how clearly this is a real, actionable commitment (not a vague idea).
- assignee_confidence is 0-1 for how confident you are in suggested_assignee_email.

Speaker labels:
- Transcripts may use "Speaker 1", "Speaker 2", "Me", or similar. Use calendar attendees and the summary for context, but do not invent which generic label is which person unless the transcript makes it clear.
- "Me" is usually the meeting recorder when that is how the device labelled the local speaker.

Assignee rules (critical):
- The meeting recorder (primary user) is identified in the user message. Account members (name + email) are listed when available.
- Only assign when there is explicit evidence in the transcript (direct address, "I'll…", "Sarah will send…", accepted commitment).
- Do NOT assign to the recorder just because they attended or recorded the call.
- If assignment is ambiguous, set suggested_assignee_email to null, assignee_confidence below 0.6, and keep the item for review.
- Never guess an assignee email.
- If the source clearly assigns work to a named account member, set suggested_assignee_email to that member's email.
- If the source assigns work to a client, vendor, or other non-member: KEEP the item, set suggested_assignee_email to null, assignee_confidence at most 0.5, and name that person in suggested_description (e.g. "Client: Alex to send brand assets").
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

export function isTranscriptTooThinForTaskExtraction(transcript: string) {
  return transcript.trim().length < MIN_TRANSCRIPT_CHARS_FOR_TASK_EXTRACTION;
}

function normalizeExtractedTitle(title: string) {
  return title.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Drop near-duplicate titles within a single extraction batch (keep first). */
export function dedupeMeetingExtractedItems(
  items: MeetingExtractedActionItem[],
): MeetingExtractedActionItem[] {
  const kept: MeetingExtractedActionItem[] = [];
  const seen = new Set<string>();

  for (const item of items) {
    const key = normalizeExtractedTitle(item.suggestedTitle);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    kept.push(item);
  }

  return kept;
}

/**
 * Client/vendor commitments must stay reviewable. Clear non-member emails and
 * note the external owner in the description instead of dropping the item.
 */
export function retainExternalMeetingAssignees(
  items: MeetingExtractedActionItem[],
  members: ExtractAccountMember[],
  recorderEmail: string,
): MeetingExtractedActionItem[] {
  const ownerEmail = recorderEmail.trim().toLowerCase();
  const memberEmails = new Set(
    members.map((entry) => entry.email.trim().toLowerCase()),
  );

  return items.map((item) => {
    const rawEmail = item.suggestedAssigneeEmail?.trim() || null;
    const email = rawEmail?.toLowerCase() || null;
    if (!email || email === ownerEmail || memberEmails.has(email)) {
      return item;
    }

    const ownerNote = `External owner mentioned: ${rawEmail}`;
    const description = item.suggestedDescription?.trim();
    return {
      ...item,
      suggestedAssigneeEmail: null,
      assigneeConfidence: Math.min(item.assigneeConfidence ?? 0.4, 0.4),
      suggestedDescription: description
        ? `${description}\n\n${ownerNote}`
        : ownerNote,
    };
  });
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
      return dedupeMeetingExtractedItems(
        parseExtractResponse(raw).map((item) => ({
          suggestedTitle: item.title,
          suggestedDescription: item.detail,
          suggestedDueDate: item.suggestedDueDate,
          suggestedDurationMinutes: item.suggestedDurationMinutes,
          sourceExcerpt: item.sourceExcerpt,
          taskConfidence: null,
          assigneeConfidence: item.assigneeConfidence,
          suggestedAssigneeEmail: item.suggestedAssigneeEmail,
        })),
      );
    }

    try {
      json = JSON.parse(cleaned.slice(start, end + 1));
    } catch {
      return [];
    }
  }

  const parsed = MeetingExtractResponseSchema.safeParse(json);

  if (!parsed.success) {
    return dedupeMeetingExtractedItems(
      parseExtractResponse(raw).map((item) => ({
        suggestedTitle: item.title,
        suggestedDescription: item.detail,
        suggestedDueDate: item.suggestedDueDate,
        suggestedDurationMinutes: item.suggestedDurationMinutes,
        sourceExcerpt: item.sourceExcerpt,
        taskConfidence: null,
        assigneeConfidence: item.assigneeConfidence,
        suggestedAssigneeEmail: item.suggestedAssigneeEmail,
      })),
    );
  }

  return dedupeMeetingExtractedItems(
    parsed.data.items
      .map((item) => {
        const title = (item.suggested_title ?? item.title ?? '').trim();
        const description =
          item.suggested_description?.trim() || item.detail?.trim() || null;

        return {
          suggestedTitle: title,
          suggestedDescription: description,
          suggestedDueDate: normalizeDueDate(item.suggested_due_date),
          suggestedDurationMinutes: normalizeDurationMinutes(
            item.suggested_duration_minutes,
          ),
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
      ),
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

  if (transcript && isTranscriptTooThinForTaskExtraction(transcript)) {
    return [];
  }

  const currentDate = todayLocalYmd();
  const recorderLabel = input.recorderName?.trim()
    ? `${input.recorderName.trim()} <${input.recorderEmail}>`
    : input.recorderEmail;
  const truncated = transcript.length > MAX_TRANSCRIPT_CHARS;

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

Full transcript${truncated ? ' (truncated for length; prefer commitments that appear in the provided text)' : ''}:
---
${transcript.slice(0, MAX_TRANSCRIPT_CHARS)}
---

Respond with JSON only.`;

  const raw = await callAI({
    feature: 'meeting_action_items',
    systemPrompt: EXTRACT_SYSTEM,
    userPrompt: userContent,
    accountId: input.accountId,
    supabase: input.supabase,
  });
  if (!raw?.trim()) {
    throw new Error('Empty extraction response from Anthropic');
  }

  return parseMeetingExtractResponse(raw);
}
