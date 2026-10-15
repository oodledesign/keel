/**
 * Pure helpers for survey section notes: join for review, strip legacy
 * em-dash dividers, and decide which rows to keep when merging on save.
 */

/** Legacy take separator that used to leak into report HTML. */
export const SURVEY_SECTION_NOTE_DIVIDER = '\u2014\u2014\u2014\u2014';

export type SectionNoteLike = {
  id: string;
  body: string;
};

/**
 * Replace legacy `————` dividers with blank lines so existing rows stay
 * readable and do not appear in report HTML.
 */
export function stripSurveySectionNoteDividers(
  value: string | null | undefined,
): string {
  const text = value ?? '';
  if (!text.includes(SURVEY_SECTION_NOTE_DIVIDER)) return text;
  return text
    .split(SURVEY_SECTION_NOTE_DIVIDER)
    .map((part) => part.trim())
    .filter(Boolean)
    .join('\n\n');
}

/** Join note bodies for the content-review textarea. */
export function joinSectionNoteBodies(
  bodies: Array<string | null | undefined>,
): string {
  return bodies
    .map((body) => stripSurveySectionNoteDividers(body).trim())
    .filter(Boolean)
    .join('\n\n');
}

/**
 * Append incoming text onto an existing note with a blank line (no divider).
 */
export function appendSurveySectionNote(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string {
  const current = stripSurveySectionNoteDividers(existing).trim();
  const next = stripSurveySectionNoteDividers(incoming).trim();
  if (!current) return next;
  if (!next) return current;
  return `${current}\n\n${next}`;
}

export type MergeSectionNotesPlan = {
  keepId: string;
  body: string;
  deleteIds: string[];
};

/**
 * Plan a content-review save: write the merged body onto the first note and
 * delete the rest. Empty merge clears the first note and still deletes others.
 */
export function planMergeSectionNotes(input: {
  notes: SectionNoteLike[];
  mergedBody: string;
}): MergeSectionNotesPlan | null {
  const notes = input.notes;
  if (notes.length === 0) return null;

  const [first, ...rest] = notes;
  if (!first) return null;

  return {
    keepId: first.id,
    body: stripSurveySectionNoteDividers(input.mergedBody).trim(),
    deleteIds: rest.map((note) => note.id),
  };
}
