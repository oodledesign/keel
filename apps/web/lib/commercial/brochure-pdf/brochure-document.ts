/**
 * Brochure document model — shared between auto PDF generation and the page editor.
 */

export type BrochureOrientation = 'portrait' | 'landscape';
export type BrochureTemplateId = 'classic' | 'editorial' | 'compact';

export type BrochureSlotType = 'image' | 'text' | 'map' | 'agents' | 'facts';

export type BrochureSlotValue =
  | { type: 'image'; mediaId: string | null; url: string | null }
  | { type: 'text'; text: string }
  | {
      type: 'map';
      latitude: number | null;
      longitude: number | null;
      amenities: Array<{ label: string; index: number }>;
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
    description: 'Cover, facts, copy, photos, map, contacts',
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Section numbers, bigger photography, less text',
  },
  {
    id: 'compact',
    label: 'Compact',
    description: 'Short pack for smaller listings',
  },
];

export function newBrochurePageId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `page_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
