import {
  SURVEY_SECTION_NOTE_DIVIDER,
  appendSurveySectionNote,
  joinSectionNoteBodies,
  stripSurveySectionNoteDividers,
} from '~/lib/building-surveyor/merge-section-notes';
import {
  type SurveySectionCatalogueItem,
  onSiteCaptureSections,
  surveySectionByKey,
  surveySectionByRicsCode,
  surveySectionDisplayLabel,
} from '~/lib/building-surveyor/survey-section-catalogue';
import {
  onSiteResolvedSections,
  parseSectionOverrides,
  resolveSurveySections,
} from '~/lib/building-surveyor/survey-sections-resolver';
import type { SurveyLevel } from '~/lib/building-surveyor/survey-types';

import { NativeHttpError } from './http';

export {
  SURVEY_SECTION_NOTE_DIVIDER,
  appendSurveySectionNote,
  joinSectionNoteBodies,
  stripSurveySectionNoteDividers,
};

const SURVEY_SPEAKER_HEADING_RE =
  /^(?:#{1,6}\s+|\*{2})?(Me|Them|Speaker \d+)(?:\*{2})?$/i;
const SURVEY_SPEAKER_PREFIX_RE =
  /^(?:#{1,6}\s+|\*{2})?(Me|Them|Speaker \d+)(?:\*{2})?:\s*(.*)$/i;

export type NativeSectionNote = {
  id: string;
  body: string;
  origin: string | null;
  created_at: string;
};

export type NativeOnSiteSection = {
  key: string;
  heading: string;
  group: string;
  letter: string;
  rics_code: string;
  label: string;
  allows_photos: boolean;
  /** Legacy merged body for older app builds. */
  note: string;
  notes: NativeSectionNote[];
  photo_count: number;
};

/**
 * Drop meeting-style speaker headings from survey dictation.
 * Keeps ordinary prose, including lines like `Kitchen: tap drips`.
 */
export function stripSurveySpeakerLabels(
  content: string | null | undefined,
): string {
  const trimmed = content?.trim() ?? '';
  if (!trimmed) return '';

  const kept: string[] = [];
  let blankPending = false;

  for (const raw of trimmed.split('\n')) {
    const line = raw.trim();
    if (!line) {
      if (kept.length > 0) blankPending = true;
      continue;
    }
    if (SURVEY_SPEAKER_HEADING_RE.test(line)) {
      continue;
    }
    const prefixed = line.match(SURVEY_SPEAKER_PREFIX_RE);
    const text = prefixed ? (prefixed[2] ?? '').trim() : line;
    if (!text) continue;
    if (blankPending && kept.length > 0) {
      kept.push('');
    }
    blankPending = false;
    kept.push(text);
  }

  return kept.join('\n').trim();
}

export function resolveOnSiteSurveySection(
  value: string | null | undefined,
  extras?: readonly SurveySectionCatalogueItem[],
): SurveySectionCatalogueItem | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  const fromExtras = extras?.find(
    (item) =>
      item.key === raw ||
      item.ricsCode === raw ||
      item.ricsCode.toUpperCase() === raw.toUpperCase(),
  );
  if (fromExtras) return fromExtras;
  return (
    surveySectionByRicsCode(raw) ??
    surveySectionByKey(raw) ??
    surveySectionByRicsCode(raw.toUpperCase())
  );
}

export function requireOnSiteSurveySection(
  value: string | null | undefined,
  extras?: readonly SurveySectionCatalogueItem[],
): SurveySectionCatalogueItem {
  const section = resolveOnSiteSurveySection(value, extras);
  if (!section?.onSitePickable) {
    throw new NativeHttpError(
      400,
      'rics_code must be an on-site survey section',
    );
  }
  return section;
}

export function mapNativeOnSiteSections(input: {
  level: SurveyLevel | number | string | null | undefined;
  notesByCode?: Map<string, string>;
  notesListByCode?: Map<string, NativeSectionNote[]>;
  photoCountByKey?: Map<string, number>;
  /** Snapshot from proposals.survey_sections (custom / renamed / reordered). */
  sectionOverrides?: unknown;
}): NativeOnSiteSection[] {
  const notes = input.notesByCode ?? new Map<string, string>();
  const notesLists =
    input.notesListByCode ?? new Map<string, NativeSectionNote[]>();
  const photos = input.photoCountByKey ?? new Map<string, number>();

  const overrides = parseSectionOverrides(input.sectionOverrides);
  const catalogue = onSiteCaptureSections(input.level);
  const resolved = overrides
    ? onSiteResolvedSections(
        resolveSurveySections({
          level: input.level,
          overrides,
          catalogue,
        }),
      )
    : catalogue;

  return resolved.map((item) => {
    const list =
      notesLists.get(item.ricsCode) ?? notesLists.get(item.key) ?? [];
    const legacyNote =
      notes.get(item.ricsCode) ??
      notes.get(item.key) ??
      joinSectionNoteBodies(list.map((note) => note.body));

    return {
      key: item.key,
      heading: item.heading,
      group: item.group,
      letter: item.letter,
      rics_code: item.ricsCode,
      label: surveySectionDisplayLabel(item),
      allows_photos: item.allowsPhotos,
      note: legacyNote,
      notes: list,
      photo_count: photos.get(item.key) ?? photos.get(item.ricsCode) ?? 0,
    };
  });
}
