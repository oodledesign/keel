/**
 * Brochure document model — shared between auto PDF generation and the page editor.
 */
import type { BrochureContentKind } from '~/lib/commercial/brochure-pdf/brochure-content';
import type { BrochureLinkButtonId } from '~/lib/commercial/brochure-pdf/brochure-links';
import type { AmenityIcon } from '~/lib/commercial/brochure-pdf/nearby-amenities.shared';

export type BrochureOrientation = 'portrait' | 'landscape';
export type BrochureTemplateId = 'classic' | 'editorial' | 'compact';

export type BrochureDisplayOptions = {
  showRent: boolean;
  showPrice: boolean;
  showSize: boolean;
  showRates: boolean;
  showServiceCharge: boolean;
  showEstateCharge: boolean;
  showReducedPrice: boolean;
  /** Clickable cover/contact button when a public website listing URL exists. */
  showWebsiteListingButton: boolean;
  /** Clickable cover/contact button when an Ozer slideshow brochure URL exists. */
  showSlideshowBrochureButton: boolean;
};

export const DEFAULT_BROCHURE_DISPLAY_OPTIONS: BrochureDisplayOptions = {
  showRent: true,
  showPrice: true,
  showSize: true,
  showRates: true,
  showServiceCharge: true,
  showEstateCharge: false,
  showReducedPrice: false,
  showWebsiteListingButton: true,
  showSlideshowBrochureButton: true,
};

export type BrochureSlotType = 'image' | 'text' | 'map' | 'agents' | 'facts';

/** `auto` shows drawings whole and fills the frame with photos. */
export const BROCHURE_IMAGE_FITS = ['auto', 'fill', 'whole'] as const;
export type BrochureImageFit = (typeof BROCHURE_IMAGE_FITS)[number];

/** Which part of a filled photo survives the crop. */
export const BROCHURE_IMAGE_FOCUSES = ['top', 'center', 'bottom'] as const;
export type BrochureImageFocus = (typeof BROCHURE_IMAGE_FOCUSES)[number];

export type BrochureImageSlot = {
  type: 'image';
  mediaId: string | null;
  url: string | null;
  fit?: BrochureImageFit;
  focus?: BrochureImageFocus;
};

export type BrochureSlotValue =
  | BrochureImageSlot
  | { type: 'text'; text: string }
  | {
      type: 'map';
      latitude: number | null;
      longitude: number | null;
      amenities: Array<{
        label: string;
        index: number;
        latitude?: number | null;
        longitude?: number | null;
        icon?: AmenityIcon | null;
      }>;
      /** Most places to list and pin; unset shows them all. */
      limit?: number;
    }
  | { type: 'agents' }
  | {
      type: 'facts';
      rows: Array<{ label: string; value: string }>;
    };

export const BROCHURE_LAYOUT_IDS = [
  'cover_hero_band',
  'cover_photo_band',
  'facts_table',
  'description_highlights',
  'description_photo',
  'details_columns',
  'photo_full',
  'photo_grid_2',
  'photo_grid_3',
  'photo_row_3',
  'photo_grid_4',
  'photo_text',
  'floorplan',
  'epc',
  'map_amenities',
  'map_text',
  'map_top',
  'location_text',
  'contact',
] as const;

export type BrochureLayoutId = (typeof BROCHURE_LAYOUT_IDS)[number];

const COVER_LAYOUTS: ReadonlySet<BrochureLayoutId> = new Set([
  'cover_hero_band',
  'cover_photo_band',
]);

const LOCATION_LAYOUTS: ReadonlySet<BrochureLayoutId> = new Set([
  'map_amenities',
  'map_text',
  'map_top',
  'location_text',
]);

export function isCoverLayout(id: BrochureLayoutId): boolean {
  return COVER_LAYOUTS.has(id);
}

export function isLocationLayout(id: BrochureLayoutId): boolean {
  return LOCATION_LAYOUTS.has(id);
}

export type BrochurePage = {
  id: string;
  layoutId: BrochureLayoutId;
  sectionLabel?: string;
  sectionNumber?: string;
  slots: Record<string, BrochureSlotValue>;
  /** Content the current layout can't show, restored on switching back to a layout that can. */
  stash?: Record<string, BrochureSlotValue>;
  /** The page's earlier content, by content kind, restored on switching back to that content. */
  contentStash?: Partial<Record<BrochureContentKind, BrochureStashedContent>>;
  /** Link buttons left off this page (cover and contact). */
  hiddenButtons?: BrochureLinkButtonId[];
  /** Edited in the wizard: render it as shown there, without filling empty frames with spare photos. */
  curated?: boolean;
};

export type BrochureStashedContent = {
  layoutId: BrochureLayoutId;
  slots: Record<string, BrochureSlotValue>;
  stash?: Record<string, BrochureSlotValue>;
};

/** Problems the renderer noticed, shown as checks before approving. */
export type BrochureRenderWarningKind =
  | 'small_image'
  | 'missing_image'
  | 'text_cut'
  | 'empty_page'
  | 'places_cut';

export type BrochureRenderWarning = {
  pageId: string;
  /** 1-based position in the saved layout. */
  pageNumber: number;
  kind: BrochureRenderWarningKind;
};

export type BrochureDocument = {
  listingId: string;
  templateId: BrochureTemplateId;
  pageSize: 'A4';
  orientation: BrochureOrientation;
  pages: BrochurePage[];
  updatedAt?: string;
};

export const BROCHURE_TEMPLATE_OPTIONS: Array<{
  id: BrochureTemplateId;
  label: string;
  description: string;
}> = [
  {
    id: 'classic',
    label: 'Classic',
    description: 'Balanced pack — facts table, copy, photos, map',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Photo-led with section tabs and larger type',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Short dense pack for smaller listings',
  },
];

export function newBrochurePageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `page_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
