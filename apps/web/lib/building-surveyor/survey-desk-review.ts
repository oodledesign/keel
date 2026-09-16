import {
  type SurveySectionCatalogueItem,
  sectionsVisibleAtLevel,
  surveySectionByKey,
  surveySectionDisplayLabel,
} from './survey-section-catalogue';
import { type SurveyLevel } from './survey-types';

export type DeskReviewSection = {
  key: string;
  ricsCode: string;
  heading: string;
  group: string;
  letter: string;
  label: string;
  index: number;
  allowsPhotos: boolean;
  hasNotes: boolean;
  photoCount: number;
};

export function deskReviewSections(
  level: SurveyLevel | number | string | null | undefined,
  extras?: {
    noteKeys?: Iterable<string>;
    photoCountByKey?: Map<string, number>;
  },
): DeskReviewSection[] {
  const notes = new Set(
    [...(extras?.noteKeys ?? [])].map((key) => key.trim()).filter(Boolean),
  );
  const photos = extras?.photoCountByKey ?? new Map<string, number>();

  return sectionsVisibleAtLevel(level).map((item, index) => ({
    key: item.key,
    ricsCode: item.ricsCode,
    heading: item.heading,
    group: item.group,
    letter: item.letter,
    label: surveySectionDisplayLabel(item),
    index: index + 1,
    allowsPhotos: item.allowsPhotos,
    hasNotes: notes.has(item.key) || notes.has(item.ricsCode),
    photoCount: photos.get(item.key) ?? photos.get(item.ricsCode) ?? 0,
  }));
}

export function adjacentDeskReviewSection(
  sections: readonly DeskReviewSection[],
  currentKey: string,
): { previous: DeskReviewSection | null; next: DeskReviewSection | null } {
  const index = sections.findIndex((item) => item.key === currentKey);
  if (index < 0) {
    return { previous: null, next: sections[0] ?? null };
  }
  return {
    previous: sections[index - 1] ?? null,
    next: sections[index + 1] ?? null,
  };
}

export function firstDeskReviewSectionKey(
  sections: readonly DeskReviewSection[],
): string {
  return (
    sections.find((item) => item.hasNotes || item.photoCount > 0)?.key ??
    sections[0]?.key ??
    'about_inspection'
  );
}

export function deskReviewSectionByKey(
  key: string | null | undefined,
): SurveySectionCatalogueItem | undefined {
  return surveySectionByKey(key);
}
