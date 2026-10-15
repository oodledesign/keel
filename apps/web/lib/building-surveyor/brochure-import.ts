/**
 * Agent brochure PDF → survey notes (exact / AI rewritten) helpers.
 * Pills are editor-only and never exported to the report.
 */

export const BROCHURE_SECTION_KEYS = [
  'location',
  'location_grounds',
  'grounds',
] as const;

export type BrochureSectionKey = (typeof BROCHURE_SECTION_KEYS)[number];

export type SurveyObservationOrigin =
  | 'dictation'
  | 'manual'
  | 'phrase'
  | 'brochure_exact'
  | 'brochure_ai'
  | 'edited';

export type BrochureMappedPassage = {
  sectionKey: BrochureSectionKey;
  exactText: string;
  rewrittenText: string;
};

export type BrochureImportChoice = {
  sectionKey: BrochureSectionKey;
  mode: 'exact' | 'rewritten' | 'skip';
};

export function isBrochureSectionKey(
  value: string | null | undefined,
): value is BrochureSectionKey {
  return Boolean(
    value && (BROCHURE_SECTION_KEYS as readonly string[]).includes(value),
  );
}

export function parseBrochureMapping(raw: unknown): BrochureMappedPassage[] {
  if (!raw || typeof raw !== 'object') return [];
  const sections = (raw as { sections?: unknown }).sections;
  if (!Array.isArray(sections)) return [];

  const out: BrochureMappedPassage[] = [];
  for (const item of sections) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const sectionKey =
      typeof row.sectionKey === 'string' ? row.sectionKey.trim() : '';
    if (!isBrochureSectionKey(sectionKey)) continue;
    const exactText =
      typeof row.exactText === 'string' ? row.exactText.trim() : '';
    const rewrittenText =
      typeof row.rewrittenText === 'string'
        ? row.rewrittenText.trim()
        : exactText;
    if (!exactText && !rewrittenText) continue;
    out.push({
      sectionKey,
      exactText: exactText || rewrittenText,
      rewrittenText: rewrittenText || exactText,
    });
  }
  return out;
}

export function brochureOriginForMode(
  mode: 'exact' | 'rewritten',
): Extract<SurveyObservationOrigin, 'brochure_exact' | 'brochure_ai'> {
  return mode === 'exact' ? 'brochure_exact' : 'brochure_ai';
}

export function brochurePillLabel(input: {
  origin: string | null | undefined;
  body: string;
  originBody: string | null | undefined;
}): string | null {
  const origin = input.origin?.trim() ?? '';
  const body = input.body.trim();
  const originBody = (input.originBody ?? '').trim();

  if (
    originBody &&
    body &&
    body !== originBody &&
    (origin === 'brochure_exact' ||
      origin === 'brochure_ai' ||
      origin === 'edited')
  ) {
    return 'Edited';
  }

  if (origin === 'brochure_exact') return 'From PDF (exact)';
  if (origin === 'brochure_ai') return 'From PDF (AI rewritten)';
  if (origin === 'edited') return 'Edited';
  return null;
}

/** After content-review merge, mark the surviving row as edited. */
export function originAfterMergeNotes(input: {
  previousOrigin: string | null | undefined;
  previousOriginBody: string | null | undefined;
  mergedBody: string;
}): {
  origin: SurveyObservationOrigin;
  originBody: string | null;
} {
  const merged = input.mergedBody.trim();
  const previousBody = (input.previousOriginBody ?? '').trim();
  if (
    input.previousOrigin === 'brochure_exact' ||
    input.previousOrigin === 'brochure_ai'
  ) {
    if (previousBody && merged !== previousBody) {
      return { origin: 'edited', originBody: previousBody };
    }
    return {
      origin: input.previousOrigin,
      originBody: previousBody || null,
    };
  }
  return { origin: 'edited', originBody: previousBody || null };
}

export const BROCHURE_MAPPING_SYSTEM_PROMPT = `You map estate-agent brochure PDF text into RICS Home Survey property sections.
Return JSON only:
{"sections":[{"sectionKey":"location"|"location_grounds"|"grounds","exactText":"...","rewrittenText":"..."}]}

Rules:
- exactText is a verbatim passage from the brochure (or empty if none).
- rewrittenText is the same facts in neutral surveyor prose (third person, concise).
- Only use those three sectionKey values.
- Omit a section when the brochure has nothing relevant.
- Do not invent facts that are not in the brochure.`;
