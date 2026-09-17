import {
  type SurveySectionCatalogueItem,
  onSiteCaptureSections,
  surveySectionByKey,
  surveySectionByRicsCode,
  surveySectionDisplayLabel,
} from '~/lib/building-surveyor/survey-section-catalogue';
import type { SurveyLevel } from '~/lib/building-surveyor/survey-types';

import { NativeHttpError } from './http';

/** Plain-text take separator — readable in iOS Text and desk-review textareas. */
export const SURVEY_SECTION_NOTE_DIVIDER = '\u2014\u2014\u2014\u2014';

const SURVEY_SPEAKER_HEADING_RE =
  /^(?:#{1,6}\s+|\*{2})?(Me|Them|Speaker \d+)(?:\*{2})?$/i;
const SURVEY_SPEAKER_PREFIX_RE =
  /^(?:#{1,6}\s+|\*{2})?(Me|Them|Speaker \d+)(?:\*{2})?:\s*(.*)$/i;

export type NativeOnSiteSection = {
  key: string;
  heading: string;
  group: string;
  letter: string;
  rics_code: string;
  label: string;
  allows_photos: boolean;
  note: string;
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

export function appendSurveySectionNote(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string {
  const current = existing?.trim() ?? '';
  const next = incoming?.trim() ?? '';
  if (!current) return next;
  if (!next) return current;
  return `${current}\n\n${SURVEY_SECTION_NOTE_DIVIDER}\n\n${next}`;
}

export function resolveOnSiteSurveySection(
  value: string | null | undefined,
): SurveySectionCatalogueItem | undefined {
  const raw = value?.trim();
  if (!raw) return undefined;
  return (
    surveySectionByRicsCode(raw) ??
    surveySectionByKey(raw) ??
    surveySectionByRicsCode(raw.toUpperCase())
  );
}

export function requireOnSiteSurveySection(
  value: string | null | undefined,
): SurveySectionCatalogueItem {
  const section = resolveOnSiteSurveySection(value);
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
  photoCountByKey?: Map<string, number>;
}): NativeOnSiteSection[] {
  const notes = input.notesByCode ?? new Map<string, string>();
  const photos = input.photoCountByKey ?? new Map<string, number>();

  return onSiteCaptureSections(input.level).map((item) => ({
    key: item.key,
    heading: item.heading,
    group: item.group,
    letter: item.letter,
    rics_code: item.ricsCode,
    label: surveySectionDisplayLabel(item),
    allows_photos: item.allowsPhotos,
    note: notes.get(item.ricsCode) ?? notes.get(item.key) ?? '',
    photo_count: photos.get(item.key) ?? photos.get(item.ricsCode) ?? 0,
  }));
}
