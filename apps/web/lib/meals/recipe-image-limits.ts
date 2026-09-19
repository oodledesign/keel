/**
 * Recipe cover + import photo limits.
 *
 * Old behaviour rejected originals over 4 MB and then posted the file as a
 * data URL. A 3–4 MB phone screenshot becomes ~5 MB of JSON and blows the
 * 4 MB server-action / Vercel body limit. HEIC was also excluded.
 *
 * New behaviour: accept originals up to 25 MB (including HEIC), compress on
 * the client to max edge 2048px JPEG ~1.5 MB, then send that.
 */

export const RECIPE_IMAGE_MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const RECIPE_IMAGE_MAX_OUTPUT_BYTES = 1_500_000;
export const RECIPE_IMAGE_MAX_LONG_EDGE = 2048;
export const RECIPE_IMAGE_JPEG_QUALITY = 0.82;
/** ~1.5 MB binary as a data URL, with headroom for the prefix. */
export const RECIPE_IMAGE_DATA_URL_MAX_CHARS = 2_800_000;
export const RECIPE_IMAGE_REMOTE_MAX_BYTES = 8_000_000;

export const RECIPE_IMAGE_ACCEPT =
  'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';
