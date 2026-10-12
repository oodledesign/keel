import type {
  BrochureLayoutId,
  BrochurePage,
  BrochureTemplateId,
} from '~/lib/commercial/brochure-pdf/brochure-document';

/** Small heading above the title on Classic and Compact pages. */
export const PAGE_EYEBROWS: Partial<Record<BrochureLayoutId, string>> = {
  facts_table: 'The opportunity',
  description_highlights: 'Description',
  description_photo: 'Description',
  details_columns: 'Particulars',
  floorplan: 'Accommodation',
  map_amenities: 'Location',
  map_text: 'Location',
  map_top: 'Location',
  location_text: 'Location',
  contact: 'Viewing & enquiries',
};

export const DEFAULT_OFFICE_HEADING = 'Office';
export const DEFAULT_NOTICE_HEADING = 'Important notice';
export const DEFAULT_CONTACT_TITLE = 'Strictly by appointment';

const HEADER_LAYOUTS: ReadonlySet<BrochureLayoutId> = new Set([
  'facts_table',
  'description_highlights',
  'description_photo',
  'details_columns',
  'photo_text',
  'floorplan',
  'map_amenities',
  'map_text',
  'map_top',
  'location_text',
  'contact',
]);

export type BrochureHeadingKey = 'eyebrow' | 'officeLabel' | 'noticeLabel';

export const BROCHURE_HEADING_KEYS: readonly BrochureHeadingKey[] = [
  'eyebrow',
  'officeLabel',
  'noticeLabel',
];

export type BrochureHeadingField = {
  key: BrochureHeadingKey;
  label: string;
  /** Shown when the field is blank, which is what the PDF uses. */
  placeholder: string;
};

/**
 * The page's small heading when none is set; null means the property name,
 * which Editorial pages without a section tab show instead.
 */
export function defaultBrochureEyebrow(
  page: Pick<BrochurePage, 'layoutId' | 'sectionLabel' | 'sectionNumber'>,
  templateId: BrochureTemplateId,
): string | null {
  if (page.layoutId === 'contact') return PAGE_EYEBROWS.contact!;
  if (templateId !== 'editorial') {
    return PAGE_EYEBROWS[page.layoutId] ?? page.sectionLabel ?? '';
  }
  return page.sectionNumber ? (page.sectionLabel ?? '') : null;
}

/** Heading slots a layout draws. */
export function headingKeysFor(
  layoutId: BrochureLayoutId,
): BrochureHeadingKey[] {
  if (layoutId === 'contact') return [...BROCHURE_HEADING_KEYS];
  return HEADER_LAYOUTS.has(layoutId) ? ['eyebrow'] : [];
}

/** Headings on this page that can be renamed. */
export function headingFieldsFor(
  page: Pick<BrochurePage, 'layoutId' | 'sectionLabel' | 'sectionNumber'>,
  templateId: BrochureTemplateId,
): BrochureHeadingField[] {
  return headingKeysFor(page.layoutId).map((key) => {
    switch (key) {
      case 'eyebrow': {
        const eyebrow = defaultBrochureEyebrow(page, templateId);
        return {
          key,
          label: 'Small heading',
          placeholder: eyebrow === null ? 'Property name' : eyebrow || 'None',
        };
      }
      case 'officeLabel':
        return {
          key,
          label: 'Office heading',
          placeholder: DEFAULT_OFFICE_HEADING,
        };
      case 'noticeLabel':
        return {
          key,
          label: 'Notice heading',
          placeholder: DEFAULT_NOTICE_HEADING,
        };
    }
  });
}

export function isBrochureHeadingKey(key: string): key is BrochureHeadingKey {
  return (BROCHURE_HEADING_KEYS as readonly string[]).includes(key);
}
