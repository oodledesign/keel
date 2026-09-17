/**
 * Publish gap check. Flags consistency issues only — never rewrites content.
 */

export const SURVEY_GAP_KINDS = [
  'empty_section',
  'photos_without_text',
  'text_without_photos',
] as const;

export type SurveyGapKind = (typeof SURVEY_GAP_KINDS)[number];

export type SurveyGapSectionInput = {
  key: string;
  ricsCode: string;
  label: string;
  allowsPhotos: boolean;
  hasNotes: boolean;
  photoCount: number;
};

export type SurveyGapFlag = {
  kind: SurveyGapKind;
  sectionKey: string;
  ricsCode: string;
  label: string;
  detail: string;
};

export type SurveyGapCheckResult = {
  flags: SurveyGapFlag[];
  readyToPublish: boolean;
  emptySectionCount: number;
  photosWithoutTextCount: number;
  textWithoutPhotosCount: number;
};

function flag(
  kind: SurveyGapKind,
  section: SurveyGapSectionInput,
  detail: string,
): SurveyGapFlag {
  return {
    kind,
    sectionKey: section.key,
    ricsCode: section.ricsCode,
    label: section.label,
    detail,
  };
}

export function buildSurveyGapCheck(
  sections: readonly SurveyGapSectionInput[],
): SurveyGapCheckResult {
  const flags: SurveyGapFlag[] = [];

  for (const section of sections) {
    const hasPhotos = section.photoCount > 0;
    if (!section.hasNotes && !hasPhotos) {
      flags.push(
        flag(
          'empty_section',
          section,
          `${section.label} has no notes and no photographs.`,
        ),
      );
      continue;
    }
    if (!section.hasNotes && hasPhotos) {
      flags.push(
        flag(
          'photos_without_text',
          section,
          `${section.label} has photographs but no written note.`,
        ),
      );
    }
    if (section.hasNotes && section.allowsPhotos && !hasPhotos) {
      flags.push(
        flag(
          'text_without_photos',
          section,
          `${section.label} has notes but no photographs.`,
        ),
      );
    }
  }

  return summariseGapFlags(flags);
}

export function summariseGapFlags(
  flags: readonly SurveyGapFlag[],
): SurveyGapCheckResult {
  const emptySectionCount = flags.filter(
    (item) => item.kind === 'empty_section',
  ).length;
  const photosWithoutTextCount = flags.filter(
    (item) => item.kind === 'photos_without_text',
  ).length;
  const textWithoutPhotosCount = flags.filter(
    (item) => item.kind === 'text_without_photos',
  ).length;

  return {
    flags: [...flags],
    readyToPublish: flags.length === 0,
    emptySectionCount,
    photosWithoutTextCount,
    textWithoutPhotosCount,
  };
}

function isGapKind(value: unknown): value is SurveyGapKind {
  return (
    value === 'empty_section' ||
    value === 'photos_without_text' ||
    value === 'text_without_photos'
  );
}

/**
 * Parse an optional AI confirmation payload. Invalid or rewrite-shaped
 * entries are dropped — this check must not invent report wording.
 */
export function parseSurveyGapCheckResponse(raw: unknown): SurveyGapFlag[] {
  const source =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw) as unknown;
          } catch {
            return null;
          }
        })()
      : raw;

  const rows = Array.isArray(source)
    ? source
    : source &&
        typeof source === 'object' &&
        Array.isArray((source as { flags?: unknown }).flags)
      ? (source as { flags: unknown[] }).flags
      : [];

  const flags: SurveyGapFlag[] = [];
  for (const row of rows) {
    if (!row || typeof row !== 'object') continue;
    const record = row as Record<string, unknown>;
    if (!isGapKind(record.kind)) continue;
    if (typeof record.sectionKey !== 'string' || !record.sectionKey.trim()) {
      continue;
    }
    if (
      typeof record.detail === 'string' &&
      /rewrite|replace with/i.test(record.detail)
    ) {
      continue;
    }
    flags.push({
      kind: record.kind,
      sectionKey: record.sectionKey.trim(),
      ricsCode:
        typeof record.ricsCode === 'string' ? record.ricsCode.trim() : '',
      label:
        typeof record.label === 'string'
          ? record.label.trim()
          : record.sectionKey,
      detail:
        typeof record.detail === 'string' && record.detail.trim()
          ? record.detail.trim()
          : 'Flagged during gap check.',
    });
  }
  return flags;
}

export function mergeSurveyGapFlags(
  deterministic: readonly SurveyGapFlag[],
  extra: readonly SurveyGapFlag[],
): SurveyGapFlag[] {
  const seen = new Set(
    deterministic.map((flag) => `${flag.kind}:${flag.sectionKey}`),
  );
  const merged = [...deterministic];
  for (const flag of extra) {
    const key = `${flag.kind}:${flag.sectionKey}`;
    if (seen.has(key)) continue;
    seen.add(key);
    merged.push(flag);
  }
  return merged;
}
