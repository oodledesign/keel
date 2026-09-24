import { sortListingMedia } from '~/lib/commercial/listing-media-order';

export type PropertyHiveFeedMediaInput = {
  id: string;
  media_type: string;
  file_name: string | null;
  mime_type: string | null;
  sort_order: number | null;
  created_at?: string | null;
};

export type PropertyHiveFeedImage = {
  name: string;
  url: string;
};

export type PropertyHiveFeedFile = {
  name: string;
  url: string;
  type: string;
  /** Listing media category, when this file came from `commercial_listing_media`. */
  mediaType?: string;
};

/**
 * These categories are documents even when the file itself is a JPEG/PNG.
 * Brochure, floor plan, and EPC uploads accept images as well as PDFs.
 * Treating them as gallery photos leaves `<files/>` empty, so Property Hive
 * has nothing to attach as a downloadable brochure.
 */
const DOCUMENT_MEDIA_TYPES = new Set([
  'brochure',
  'floorplan',
  'epc',
  'goad',
  'other',
  'video',
]);

function feedFileType(mediaType: string): string {
  if (mediaType === 'floorplan' || mediaType === 'goad') return '2';
  if (mediaType === 'epc') return '3';
  // Kato file type 11 is a brochure / particulars. Other documents use it too.
  return '11';
}

function isGalleryImage(item: PropertyHiveFeedMediaInput): boolean {
  if (DOCUMENT_MEDIA_TYPES.has(item.media_type)) return false;
  if (item.media_type === 'image' || item.media_type === 'aerial') return true;
  return Boolean(item.mime_type?.startsWith('image/'));
}

/**
 * Split listing media into Property Hive / EACH `<images>` and `<files>`
 * in presentation order (`sort_order`, then `created_at`, then `id`).
 * Gallery photos and aerials stay in `<images>`. Brochure, floor plan, EPC,
 * Goad, and other documents stay in `<files>` even when they are images.
 */
export function collectPropertyHiveFeedMedia(
  media: readonly PropertyHiveFeedMediaInput[],
  resolveUrl: (item: PropertyHiveFeedMediaInput) => string | null,
): {
  images: PropertyHiveFeedImage[];
  files: PropertyHiveFeedFile[];
} {
  const images: PropertyHiveFeedImage[] = [];
  const files: PropertyHiveFeedFile[] = [];

  for (const item of sortListingMedia(media)) {
    const url = resolveUrl(item);
    if (!url) continue;

    const name = item.file_name || `${item.media_type}-${item.id}`;

    if (isGalleryImage(item)) {
      images.push({ name, url });
    } else {
      files.push({
        name,
        url,
        type: feedFileType(item.media_type),
        mediaType: item.media_type,
      });
    }
  }

  return { images, files };
}
