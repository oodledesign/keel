/**
 * Brochure document model — shared between auto PDF generation and the page editor.
 */
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
    }
  | { type: 'agents' }
  | {
      type: 'facts';
      rows: Array<{ label: string; value: string }>;
    };

export type BrochureLayoutId =
  | 'cover_hero_band'
  | 'facts_table'
  | 'description_highlights'
  | 'details_columns'
  | 'photo_full'
  | 'photo_grid_2'
  | 'photo_grid_3'
  | 'floorplan'
  | 'map_amenities'
  | 'contact';

export type BrochurePage = {
  id: string;
  layoutId: BrochureLayoutId;
  sectionLabel?: string;
  sectionNumber?: string;
  slots: Record<string, BrochureSlotValue>;
};

/** Problems the renderer noticed, shown as checks before approving. */
export type BrochureRenderWarningKind =
  | 'small_image'
  | 'missing_image'
  | 'text_cut'
  | 'empty_page';

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
