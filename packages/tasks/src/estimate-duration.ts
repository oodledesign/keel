import { parseDurationMinutes } from './parse-duration';

/** Fallback when title/notes have no duration phrase and no keyword band. */
export const DEFAULT_ESTIMATED_DURATION_MINUTES = 30;

const KEYWORD_BANDS = [
  {
    minutes: 60,
    pattern: /\b(designs?|designing|writes?|writing)\b/i,
  },
  {
    minutes: 45,
    pattern: /\b(reviews?|reviewing)\b/i,
  },
  {
    minutes: 15,
    pattern: /\b(e-?mails?|emailed|emailing|quick(?:ly)?|admin)\b/i,
  },
] as const;

function joinTitleNotes(title?: string | null, notes?: string | null): string {
  return [title, notes]
    .map((part) => part?.trim() ?? '')
    .filter(Boolean)
    .join(' ');
}

function estimateDurationFromKeywords(text: string): number | null {
  for (const band of KEYWORD_BANDS) {
    if (band.pattern.test(text)) {
      return band.minutes;
    }
  }

  return null;
}

/**
 * Estimate task effort in minutes for MCP create paths.
 * Prefers an explicit duration phrase in title/notes, then keyword bands,
 * then {@link DEFAULT_ESTIMATED_DURATION_MINUTES}.
 */
export function estimateTaskDurationMinutes(input: {
  title?: string | null;
  notes?: string | null;
}): number {
  const text = joinTitleNotes(input.title, input.notes);
  const parsed = text ? parseDurationMinutes(text) : null;
  if (parsed != null) {
    return parsed;
  }

  return (
    estimateDurationFromKeywords(text) ?? DEFAULT_ESTIMATED_DURATION_MINUTES
  );
}
