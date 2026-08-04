import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';

const MAX_TRANSCRIPT_CHARS = 120_000;

export type MeetingSummaryInput = {
  title: string;
  transcript: string;
  meetingDate?: string | null;
  attendees?: Array<{ name: string; email: string }>;
};

function formatAttendeeList(
  attendees: Array<{ name: string; email: string }> | undefined,
): string {
  if (!attendees?.length) {
    return 'Attendees: (not available from calendar)';
  }

  const lines = attendees
    .filter((attendee) => attendee.email.trim())
    .map((attendee) => {
      const name = attendee.name.trim() || attendee.email.trim();
      return `- ${name} <${attendee.email.trim()}>`;
    });

  if (lines.length === 0) {
    return 'Attendees: (not available from calendar)';
  }

  return `Attendees:\n${lines.join('\n')}`;
}

export async function generateMeetingSummaryText(
  input: MeetingSummaryInput,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<string> {
  const trimmedTranscript = input.transcript.trim();
  if (!trimmedTranscript) {
    throw new Error('Transcript is empty');
  }

  const title = input.title.trim() || 'Meeting';
  const meetingDate = input.meetingDate?.trim() || 'Unknown date';

  const system = `You write meeting recaps for busy professionals.
Use light Markdown only:
- ## Section headings for themes such as Discussion, Decisions, and Follow-ups (omit empty sections)
- Short paragraphs where prose helps
- Bullet lists (- item) for decisions, owners, open questions, and action items
Do not use tables, code fences, or horizontal rules.
Cover what was discussed, decisions made, and open questions or follow-ups.
Attribute speakers by name when the transcript makes who said what clear.
Write in a neutral, professional tone suitable for forwarding to meeting attendees.
Do not invent facts, commitments, or attendees not supported by the transcript.
If the transcript is too thin to summarize meaningfully, say so briefly in one short paragraph.`;

  const userContent = `Meeting title: ${title}
Meeting date: ${meetingDate}

${formatAttendeeList(input.attendees)}

Transcript:
---
${trimmedTranscript.slice(0, MAX_TRANSCRIPT_CHARS)}
---`;

  const text = await callAI({
    feature: 'meeting_summary',
    systemPrompt: system,
    userPrompt: userContent,
    accountId: meter.accountId,
    supabase: meter.supabase,
  });

  if (!text?.trim()) {
    throw new Error('Empty summary from Anthropic');
  }

  return text;
}

export function attendeeEmailsFromCalendarAttendees(
  attendees: Array<{ name: string; email: string }>,
): string[] {
  const emails = attendees
    .map((attendee) => attendee.email.trim().toLowerCase())
    .filter((email) => email.includes('@'));

  return [...new Set(emails)];
}
