import {
  type SurveySectionCatalogueItem,
  onSiteCaptureSections,
  surveySectionByKey,
  surveySectionByRicsCode,
  surveySectionDisplayLabel,
} from '~/lib/building-surveyor/survey-section-catalogue';
import type { SurveyLevel } from '~/lib/building-surveyor/survey-types';

import { NativeHttpError } from './http';

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

export function appendSurveySectionNote(
  existing: string | null | undefined,
  incoming: string | null | undefined,
): string {
  const current = existing?.trim() ?? '';
  const next = incoming?.trim() ?? '';
  if (!current) return next;
  if (!next) return current;
  return `${current}\n\n${next}`;
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
