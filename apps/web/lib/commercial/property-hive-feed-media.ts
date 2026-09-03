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
};

function feedFileType(mediaType: string): string {
  if (mediaType === 'floorplan') return '2';
  if (mediaType === 'epc') return '3';
  return '11';
}

/**
 * Split listing media into Property Hive / EACH `<images>` and `<files>`
 * in presentation order. Inclusion rules are unchanged — only order is
 * `sort_order`, then `created_at`, then `id`.
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
    const isImage =
      item.media_type === 'image' ||
      Boolean(item.mime_type?.startsWith('image/'));

    if (isImage) {
      images.push({ name, url });
    } else {
      files.push({
        name,
        url,
        type: feedFileType(item.media_type),
      });
    }
  }

  return { images, files };
}
