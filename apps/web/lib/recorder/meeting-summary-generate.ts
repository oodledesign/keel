import 'server-only';

import { resolveAnthropicModel } from '~/lib/ai/default-anthropic-model';

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
): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not configured');
  }

  const trimmedTranscript = input.transcript.trim();
  if (!trimmedTranscript) {
    throw new Error('Transcript is empty');
  }

  const model = resolveAnthropicModel();
  const title = input.title.trim() || 'Meeting';
  const meetingDate = input.meetingDate?.trim() || 'Unknown date';

  const system = `You write meeting recaps for busy professionals.
Write 2-4 short paragraphs of plain prose (no bullet lists, no markdown headings).
Cover: what was discussed, decisions made, and any open questions or follow-ups.
Attribute speakers by name when the transcript makes who said what clear.
Write in a neutral, professional tone suitable for forwarding to meeting attendees.
Do not invent facts, commitments, or attendees not supported by the transcript.
If the transcript is too thin to summarize meaningfully, say so briefly in one paragraph.`;

  const userContent = `Meeting title: ${title}
Meeting date: ${meetingDate}

${formatAttendeeList(input.attendees)}

Transcript:
---
${trimmedTranscript.slice(0, MAX_TRANSCRIPT_CHARS)}
---`;

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 2048,
      system,
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

  const text = body.content?.find((block) => block.type === 'text')?.text?.trim();

  if (!text) {
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
