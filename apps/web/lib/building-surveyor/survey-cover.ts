/** Largest default cover image we accept (before it is resized for the PDF). */
export const COVER_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const SURVEY_COVER_SELECT =
  'survey_cover_photo_doc_id, survey_cover_focus';

/** Where a workspace's default cover image is stored in the docs bucket. */
export function coverImageFolder(accountId: string): string {
  return `${accountId}/survey-cover/`;
}

export function isCoverImagePath(accountId: string, path: string): boolean {
  const folder = coverImageFolder(accountId);
  return (
    path.startsWith(folder) &&
    path.length > folder.length &&
    !path.includes('..') &&
    path.length <= 500
  );
}

/** True when the bytes start like a JPEG, PNG or WebP file. */
export function looksLikeImage(bytes: Uint8Array): boolean {
  const jpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47;
  const webp =
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50;
  return jpeg || png || webp;
}

export type SurveyCoverSource = 'photo' | 'default' | 'first_photo';

/**
 * Which image the cover uses: the survey's chosen photo, else the workspace
 * default image, else (for older reports) the first photo in the report.
 */
export function surveyCoverSource(input: {
  photoDocId: string | null | undefined;
  hasDefaultImage: boolean;
}): SurveyCoverSource {
  if (input.photoDocId) return 'photo';
  return input.hasDefaultImage ? 'default' : 'first_photo';
}

export function mapSurveyCoverPhotoDocId(
  row: Record<string, unknown>,
): string | null {
  const value = row.survey_cover_photo_doc_id;
  return typeof value === 'string' && value ? value : null;
}

/**
 * How the cover image sits in its frame. x and y are where the visible
 * window sits over the image (0 = left/top edge, 1 = right/bottom edge),
 * zoom is 1 (fill the frame) up to COVER_MAX_ZOOM.
 */
export type CoverFocus = { x: number; y: number; zoom: number };

export const COVER_MAX_ZOOM = 3;
export const DEFAULT_COVER_FOCUS: CoverFocus = { x: 0.5, y: 0.5, zoom: 1 };

/** Cover image frame on the PDF cover page, in points. */
export const COVER_FRAME = { width: 397, height: 587 } as const;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function normalizeCoverFocus(input: {
  x: number;
  y: number;
  zoom: number;
}): CoverFocus {
  return {
    x: clamp(input.x, 0, 1),
    y: clamp(input.y, 0, 1),
    zoom: clamp(input.zoom, 1, COVER_MAX_ZOOM),
  };
}

/** Reads a stored focus value; anything invalid gives the default. */
export function parseCoverFocus(value: unknown): CoverFocus {
  if (!value || typeof value !== 'object') return DEFAULT_COVER_FOCUS;
  const { x, y, zoom } = value as Record<string, unknown>;
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof zoom !== 'number' ||
    ![x, y, zoom].every(Number.isFinite)
  ) {
    return DEFAULT_COVER_FOCUS;
  }
  return normalizeCoverFocus({ x, y, zoom });
}

export function isDefaultCoverFocus(focus: CoverFocus): boolean {
  return (
    focus.x === DEFAULT_COVER_FOCUS.x &&
    focus.y === DEFAULT_COVER_FOCUS.y &&
    focus.zoom === DEFAULT_COVER_FOCUS.zoom
  );
}

/**
 * Size and offset of the image inside the frame, in frame units. The image
 * always covers the frame. offsetX / offsetY are the image's left / top edge
 * relative to the frame's left / top edge (zero or negative). Shared by the
 * PDF and the on-screen preview so they match.
 */
export function coverPlacement(
  image: { width: number; height: number },
  focus: CoverFocus,
  frame: { width: number; height: number } = COVER_FRAME,
) {
  const base = Math.max(frame.width / image.width, frame.height / image.height);
  const scale = base * clamp(focus.zoom, 1, COVER_MAX_ZOOM);
  const width = image.width * scale;
  const height = image.height * scale;
  const overflowX = Math.max(0, width - frame.width);
  const overflowY = Math.max(0, height - frame.height);
  return {
    width,
    height,
    overflowX,
    overflowY,
    offsetX: -overflowX * clamp(focus.x, 0, 1),
    offsetY: -overflowY * clamp(focus.y, 0, 1),
  };
}
