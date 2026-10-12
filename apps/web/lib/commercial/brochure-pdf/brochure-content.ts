import type { BrochureLayoutId } from '~/lib/commercial/brochure-pdf/brochure-document';

/** What a page is about. Layouts are different ways of showing the same content. */
export const BROCHURE_CONTENT_KINDS = [
  'cover',
  'summary',
  'description',
  'details',
  'photos',
  'floorplan',
  'location',
  'contact',
] as const;

export type BrochureContentKind = (typeof BROCHURE_CONTENT_KINDS)[number];

export const BROCHURE_CONTENT_OPTIONS: Array<{
  id: BrochureContentKind;
  label: string;
  /** First is the default when the page switches to this content. */
  layouts: BrochureLayoutId[];
  /** Editorial section tab. */
  sectionLabel: string;
}> = [
  {
    id: 'cover',
    label: 'Cover',
    layouts: ['cover_hero_band', 'cover_photo_band'],
    sectionLabel: 'Cover',
  },
  {
    id: 'summary',
    label: 'Summary',
    layouts: ['facts_table'],
    sectionLabel: 'The offering',
  },
  {
    id: 'description',
    label: 'Description',
    layouts: ['description_highlights', 'description_photo'],
    sectionLabel: 'Description',
  },
  {
    id: 'details',
    label: 'Specification & terms',
    layouts: ['details_columns'],
    sectionLabel: 'Specification',
  },
  {
    id: 'photos',
    label: 'Photos',
    layouts: [
      'photo_full',
      'photo_grid_2',
      'photo_grid_3',
      'photo_row_3',
      'photo_grid_4',
      'photo_text',
    ],
    sectionLabel: 'Photography',
  },
  {
    id: 'floorplan',
    label: 'Floor plan',
    layouts: ['floorplan'],
    sectionLabel: 'Floor plans',
  },
  {
    id: 'location',
    label: 'Location',
    layouts: ['map_amenities', 'map_text', 'map_top', 'location_text'],
    sectionLabel: 'Location',
  },
  {
    id: 'contact',
    label: 'Contact',
    layouts: ['contact'],
    sectionLabel: 'Contact',
  },
];

const CONTENT_BY_LAYOUT = new Map<BrochureLayoutId, BrochureContentKind>(
  BROCHURE_CONTENT_OPTIONS.flatMap((option) =>
    option.layouts.map((layoutId) => [layoutId, option.id] as const),
  ),
);

function option(kind: BrochureContentKind) {
  return BROCHURE_CONTENT_OPTIONS.find((o) => o.id === kind)!;
}

export function contentOf(layoutId: BrochureLayoutId): BrochureContentKind {
  return CONTENT_BY_LAYOUT.get(layoutId) ?? 'photos';
}

export function layoutsFor(kind: BrochureContentKind): BrochureLayoutId[] {
  return option(kind).layouts;
}

export function defaultLayoutFor(kind: BrochureContentKind): BrochureLayoutId {
  return option(kind).layouts[0]!;
}

export function brochureContentLabel(kind: BrochureContentKind): string {
  return option(kind).label;
}

export function brochureContentSectionLabel(kind: BrochureContentKind): string {
  return option(kind).sectionLabel;
}
