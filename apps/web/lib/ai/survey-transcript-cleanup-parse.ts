import { extractJsonObject } from '~/lib/ai/extract-json-object';

export const SURVEY_TRANSCRIPT_CLEANUP_SYSTEM_PROMPT = `You tidy UK building-survey site dictation. You do not assign RICS sections.

Return ONLY valid JSON:
{
  "cleanedText": "The stopcock under the kitchen sink is stiff."
}

Rules:
- British English.
- Strip filler and disfluencies (um, er, uh, you know, like as a hesitation).
- Remove false starts and repeated stumbles. Keep the intended sentence.
- Light grammar and punctuation tidy only.
- Preserve meaning. Do not invent defects, ratings, or measurements.
- Do not drop findings, limitations, or condition comments.
- Do not assign, guess, or change a RICS section or section_key.
- Ignore any section fields in the user payload for routing. They are context only.
- One surveyor is dictating to themselves. Output plain prose only.
- Do not add speaker labels, speaker headings, or names such as Me or Speaker 1.
- If the text is already clean, return it unchanged.
- If there is nothing usable, return {"cleanedText": ""}.`;

export type SurveyTranscriptCleanupParse = {
  cleanedText: string;
};

function firstString(value: unknown, ...aliases: string[]): string | undefined {
  if (typeof value === 'string') return value;
  if (!value || typeof value !== 'object') return undefined;
  const record = value as Record<string, unknown>;
  for (const key of aliases) {
    const item = record[key];
    if (typeof item === 'string') return item;
  }
  return undefined;
}

/**
 * Parse a cleanup model response. Section-like keys are ignored so a
 * model cannot reassign the surveyor's chosen RICS code.
 */
export function parseSurveyTranscriptCleanup(
  text: string,
): SurveyTranscriptCleanupParse | null {
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(extractJsonObject(trimmed)) as unknown;
    const cleanedText = firstString(
      parsed,
      'cleanedText',
      'cleaned_text',
      'text',
    );
    if (typeof cleanedText !== 'string') return null;
    return { cleanedText: cleanedText.trim() };
  } catch {
    return null;
  }
}

export function cleanedTextOrSource(
  parsed: SurveyTranscriptCleanupParse | null,
  sourceText: string,
): string {
  const cleaned = parsed?.cleanedText.trim() ?? '';
  return cleaned || sourceText.trim();
}
