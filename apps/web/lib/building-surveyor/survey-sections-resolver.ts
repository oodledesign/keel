/**
 * Resolve the on-site / desk section list from the built-in catalogue plus
 * optional template overrides (rename, reorder, hide, add custom_*).
 */
import {
  SURVEY_SECTION_CATALOGUE,
  type SurveySectionCatalogueItem,
  type SurveySectionKind,
  surveySectionByKey,
  surveySectionByRicsCode,
} from './survey-section-catalogue';
import { type SurveyLevel, normalizeSurveyLevel } from './survey-types';

export type SurveySectionOverride = {
  key: string;
  heading?: string;
  group?: string;
  letter?: string;
  ricsCode?: string;
  /** Hide from pickers; existing observations keep their data. */
  hidden?: boolean;
  /** Explicit sort order (lower first). Defaults to catalogue order. */
  order?: number;
  allowsPhotos?: boolean;
  onSitePickable?: boolean;
  allowsRating?: boolean;
  kind?: SurveySectionKind;
};

export type ResolvedSurveySection = SurveySectionCatalogueItem & {
  /** True when this section is not in the built-in catalogue. */
  isCustom: boolean;
  /** True when the heading was overridden. */
  renamed: boolean;
};

const CUSTOM_KEY_RE = /^custom_[a-z0-9]+(?:_[a-z0-9]+)*$/;

export function isCustomSectionKey(key: string): boolean {
  return CUSTOM_KEY_RE.test(key.trim());
}

export function slugifyCustomSectionKey(heading: string): string {
  const slug = heading
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
  return `custom_${slug || 'section'}`;
}

export function parseSectionOverrides(
  value: unknown,
): SurveySectionOverride[] | null {
  if (value == null) return null;
  if (!Array.isArray(value)) return null;
  const out: SurveySectionOverride[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const key = typeof row.key === 'string' ? row.key.trim() : '';
    if (!key) continue;
    out.push({
      key,
      heading: typeof row.heading === 'string' ? row.heading : undefined,
      group: typeof row.group === 'string' ? row.group : undefined,
      letter: typeof row.letter === 'string' ? row.letter : undefined,
      ricsCode: typeof row.ricsCode === 'string' ? row.ricsCode : undefined,
      hidden: row.hidden === true,
      order: typeof row.order === 'number' ? row.order : undefined,
      allowsPhotos:
        typeof row.allowsPhotos === 'boolean' ? row.allowsPhotos : undefined,
      onSitePickable:
        typeof row.onSitePickable === 'boolean'
          ? row.onSitePickable
          : undefined,
      allowsRating:
        typeof row.allowsRating === 'boolean' ? row.allowsRating : undefined,
      kind:
        row.kind === 'section' ||
        row.kind === 'sub_item' ||
        row.kind === 'field'
          ? row.kind
          : undefined,
    });
  }
  return out;
}

function catalogueBase(level: SurveyLevel): SurveySectionCatalogueItem[] {
  return SURVEY_SECTION_CATALOGUE.filter((item) =>
    item.visibleOnLevels.includes(level),
  );
}

type OrderedSection = ResolvedSurveySection & { sortOrder: number };

/**
 * Merge catalogue + overrides. Null/undefined overrides → built-in list.
 * Hidden catalogue sections are omitted. Custom keys are appended.
 */
export function resolveSurveySections(input: {
  level?: SurveyLevel | number | string | null;
  overrides?: SurveySectionOverride[] | null;
  catalogue?: readonly SurveySectionCatalogueItem[];
}): ResolvedSurveySection[] {
  const level = normalizeSurveyLevel(input.level);
  const base = [...(input.catalogue ?? catalogueBase(level))];
  const overrides = input.overrides ?? null;

  if (!overrides || overrides.length === 0) {
    return base.map((item) => ({
      ...item,
      isCustom: false,
      renamed: false,
    }));
  }

  const byKey = new Map(overrides.map((item) => [item.key, item]));
  const ordered: OrderedSection[] = [];

  for (let index = 0; index < base.length; index++) {
    const item = base[index]!;
    const override = byKey.get(item.key);
    if (override?.hidden) continue;
    const heading = override?.heading?.trim() || item.heading;
    ordered.push({
      ...item,
      heading,
      group: override?.group?.trim() || item.group,
      letter: override?.letter?.trim() || item.letter,
      ricsCode: override?.ricsCode?.trim() || item.ricsCode,
      allowsPhotos: override?.allowsPhotos ?? item.allowsPhotos,
      onSitePickable: override?.onSitePickable ?? item.onSitePickable,
      allowsRating: override?.allowsRating ?? item.allowsRating,
      kind: override?.kind ?? item.kind,
      isCustom: false,
      renamed: Boolean(
        override?.heading?.trim() && override.heading !== item.heading,
      ),
      sortOrder: typeof override?.order === 'number' ? override.order : index,
    });
  }

  for (const override of overrides) {
    if (!isCustomSectionKey(override.key)) continue;
    if (override.hidden) continue;
    if (ordered.some((item) => item.key === override.key)) continue;
    const heading = override.heading?.trim() || 'Custom section';
    const ricsCode = override.ricsCode?.trim() || override.key;
    ordered.push({
      key: override.key,
      heading,
      group: override.group?.trim() || 'Custom',
      letter: override.letter?.trim() || 'Z',
      ricsCode,
      kind: override.kind ?? 'sub_item',
      keywords: [heading.toLowerCase()],
      allowsRating: override.allowsRating ?? false,
      allowsPhotos: override.allowsPhotos ?? true,
      visibleOnLevels: [2, 3],
      onSitePickable: override.onSitePickable ?? true,
      isCustom: true,
      renamed: false,
      sortOrder: override.order ?? 10_000 + ordered.length,
    });
  }

  return ordered
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...item }) => item);
}

export function resolvedSectionByKey(
  sections: readonly ResolvedSurveySection[],
  key: string,
): ResolvedSurveySection | undefined {
  const raw = key.trim();
  if (!raw) return undefined;
  return (
    sections.find((item) => item.key === raw) ??
    sections.find((item) => item.ricsCode === raw) ??
    sections.find((item) => item.ricsCode.toUpperCase() === raw.toUpperCase())
  );
}

/** Loose check used by Zod / capture when no survey snapshot is loaded. */
export function isResolvableSectionKey(key: string): boolean {
  const raw = key.trim();
  if (!raw) return false;
  if (isCustomSectionKey(raw)) return true;
  return Boolean(
    surveySectionByKey(raw) ||
    surveySectionByRicsCode(raw) ||
    surveySectionByRicsCode(raw.toUpperCase()),
  );
}

export function onSiteResolvedSections(
  sections: readonly ResolvedSurveySection[],
): ResolvedSurveySection[] {
  return sections.filter((item) => item.onSitePickable);
}

/** Snapshot shape stored on proposals.survey_sections. */
export function snapshotResolvedSections(
  sections: readonly ResolvedSurveySection[],
): SurveySectionOverride[] {
  return sections.map((item, index) => ({
    key: item.key,
    heading: item.heading,
    group: item.group,
    letter: item.letter,
    ricsCode: item.ricsCode,
    order: index,
    allowsPhotos: item.allowsPhotos,
    onSitePickable: item.onSitePickable,
    allowsRating: item.allowsRating,
    kind: item.kind,
  }));
}
