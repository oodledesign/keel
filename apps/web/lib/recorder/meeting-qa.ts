import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { callAI } from '~/lib/ai/router';

const MAX_TRANSCRIPT_CHARS = 120_000;
const MAX_HISTORY_TURNS = 8;

export type MeetingQaHistoryMessage = {
  role: 'user' | 'assistant';
  content: string;
};

export type MeetingQaInput = {
  title: string;
  transcript: string;
  summaryText?: string | null;
  meetingDate?: string | null;
  question: string;
  history?: MeetingQaHistoryMessage[];
};

export async function answerMeetingQuestion(
  input: MeetingQaInput,
  meter: { accountId: string; supabase: SupabaseClient },
): Promise<string> {
  const transcript = input.transcript.trim();
  if (!transcript) {
    throw new Error('Transcript is empty');
  }

  const question = input.question.trim();
  if (!question) {
    throw new Error('Question is empty');
  }

  const title = input.title.trim() || 'Meeting';
  const meetingDate = input.meetingDate?.trim() || 'Unknown date';
  const summary = input.summaryText?.trim();
  const truncated = transcript.length > MAX_TRANSCRIPT_CHARS;
  const transcriptForPrompt = transcript.slice(0, MAX_TRANSCRIPT_CHARS);

  const system = `You answer questions about a single meeting using only the provided notes and transcript.
Stay factual. Prefer short, clear answers.
When useful, quote or paraphrase speakers by name.
If the transcript does not contain enough information, say what is missing instead of inventing details.
Use light Markdown (short paragraphs and bullet lists) when it helps readability.
Do not answer questions unrelated to this meeting.
${truncated ? 'Note: the transcript was truncated for length; if something seems missing, say the available transcript may be incomplete.\n' : ''}
Meeting title: ${title}
Meeting date: ${meetingDate}
${summary ? `\nExisting summary:\n${summary}\n` : ''}
Transcript:
---
${transcriptForPrompt}
---`;

  const history = (input.history ?? [])
    .filter((message) => message.content.trim())
    .slice(-MAX_HISTORY_TURNS);

  const historyBlock =
    history.length > 0
      ? `Earlier questions in this chat:\n${history
          .map(
            (message) =>
              `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content.trim()}`,
          )
          .join('\n\n')}\n\n`
      : '';

  const userPrompt = `${historyBlock}Question: ${question}`;

  const text = await callAI({
    feature: 'meeting_qa',
    systemPrompt: system,
    userPrompt,
    accountId: meter.accountId,
    supabase: meter.supabase,
    usePromptCaching: true,
  });

  if (!text?.trim()) {
    throw new Error('Empty answer from AI');
  }

  return text.trim();
}
