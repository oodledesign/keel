import {
  compressUploadImageFile,
  fileToDataUrl,
} from '~/lib/images/compress-upload-image';

import {
  RECIPE_IMAGE_JPEG_QUALITY,
  RECIPE_IMAGE_MAX_LONG_EDGE,
  RECIPE_IMAGE_MAX_ORIGINAL_BYTES,
  RECIPE_IMAGE_MAX_OUTPUT_BYTES,
} from './recipe-image-limits';

export {
  RECIPE_IMAGE_ACCEPT,
  RECIPE_IMAGE_JPEG_QUALITY,
  RECIPE_IMAGE_MAX_LONG_EDGE,
  RECIPE_IMAGE_MAX_ORIGINAL_BYTES,
  RECIPE_IMAGE_MAX_OUTPUT_BYTES,
} from './recipe-image-limits';

export { CompressUploadImageError } from '~/lib/images/compress-upload-image';

/**
 * Compress a recipe cover / import photo, then return a JPEG (or small
 * original) data URL safe to POST as JSON.
 */
export async function prepareRecipeImageDataUrl(file: File): Promise<string> {
  const compressed = await compressUploadImageFile(file, {
    maxOriginalBytes: RECIPE_IMAGE_MAX_ORIGINAL_BYTES,
    maxOutputBytes: RECIPE_IMAGE_MAX_OUTPUT_BYTES,
    maxLongEdge: RECIPE_IMAGE_MAX_LONG_EDGE,
    quality: RECIPE_IMAGE_JPEG_QUALITY,
  });

  return fileToDataUrl(compressed);
}
