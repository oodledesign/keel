/**
 * Phrase book insert helpers. Each phrase becomes its own editable block —
 * never merged into an existing paragraph.
 */

export const SURVEY_PHRASE_DRAG_MIME = 'application/x-ozer-survey-phrase';

export type PhraseDragPayload = {
  title: string;
  body: string;
  ricsCode?: string | null;
  sectionKey?: string | null;
  defaultRating?: string | null;
};

export type PhraseInsertMode = 'fill-empty' | 'new-block';

export function phraseInsertMode(
  existingBody: string | null | undefined,
): PhraseInsertMode {
  return existingBody?.trim() ? 'new-block' : 'fill-empty';
}

/** Append a phrase as a distinct body. Empty phrases are ignored. */
export function phraseBodiesAfterInsert(
  existingBodies: readonly string[],
  phraseBody: string,
): string[] {
  const next = phraseBody.trim();
  const kept = existingBodies.map((body) => body.trim()).filter(Boolean);
  if (!next) return kept;
  return [...kept, next];
}

export function escapePhraseHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** One phrase → one report text block (never concatenated into a neighbour). */
export function phraseToReportTextHtml(body: string): string {
  const trimmed = body.trim();
  if (!trimmed) return '<p></p>';
  const paragraphs = trimmed
    .split(/\n{2,}/)
    .map(
      (part) => `<p>${escapePhraseHtml(part).replaceAll('\n', '<br />')}</p>`,
    );
  return paragraphs.join('');
}

export function groupPhrasesBySectionCode<
  T extends { ricsCode?: string | null; sectionKey?: string | null },
>(phrases: readonly T[]): Array<{ code: string; items: T[] }> {
  const groups = new Map<string, T[]>();
  for (const phrase of phrases) {
    const code =
      phrase.ricsCode?.trim() || phrase.sectionKey?.trim() || 'Other';
    const items = groups.get(code) ?? [];
    items.push(phrase);
    groups.set(code, items);
  }
  return [...groups.entries()].map(([code, items]) => ({ code, items }));
}

export function phraseMatchesQuery(
  phrase: { title: string; body: string; ricsCode?: string | null },
  query: string,
): boolean {
  const term = query.trim().toLowerCase();
  if (!term) return true;
  return (
    phrase.title.toLowerCase().includes(term) ||
    phrase.body.toLowerCase().includes(term) ||
    (phrase.ricsCode ?? '').toLowerCase().includes(term)
  );
}

export function serializePhraseDrag(payload: PhraseDragPayload): string {
  return JSON.stringify(payload);
}

export function parsePhraseDrag(
  raw: string | null | undefined,
): PhraseDragPayload | null {
  if (!raw?.trim()) return null;
  try {
    const value = JSON.parse(raw) as Partial<PhraseDragPayload>;
    if (typeof value.body !== 'string' || !value.body.trim()) return null;
    return {
      title: typeof value.title === 'string' ? value.title : '',
      body: value.body,
      ricsCode: value.ricsCode ?? null,
      sectionKey: value.sectionKey ?? null,
      defaultRating: value.defaultRating ?? null,
    };
  } catch {
    return null;
  }
}
