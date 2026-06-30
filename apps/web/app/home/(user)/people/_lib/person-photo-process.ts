const OUTPUT_SIZE = 512;
const JPEG_QUALITY = 0.85;

export type CropTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function getCoverScale(
  imageWidth: number,
  imageHeight: number,
  viewportSize: number,
) {
  return Math.max(viewportSize / imageWidth, viewportSize / imageHeight);
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new window.Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not load image'));
    };

    image.src = url;
  });
}

export async function exportSquareCrop(
  image: HTMLImageElement,
  viewportSize: number,
  transform: CropTransform,
): Promise<File> {
  const canvas = document.createElement('canvas');
  canvas.width = OUTPUT_SIZE;
  canvas.height = OUTPUT_SIZE;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is not supported');
  }

  const baseScale = getCoverScale(image.width, image.height, viewportSize);
  const totalScale = baseScale * transform.scale;
  const drawWidth = image.width * totalScale;
  const drawHeight = image.height * totalScale;
  const x = (viewportSize - drawWidth) / 2 + transform.offsetX;
  const y = (viewportSize - drawHeight) / 2 + transform.offsetY;
  const ratio = OUTPUT_SIZE / viewportSize;

  ctx.fillStyle = 'var(--ozer-plum-900)';
  ctx.fillRect(0, 0, OUTPUT_SIZE, OUTPUT_SIZE);
  ctx.drawImage(
    image,
    0,
    0,
    image.width,
    image.height,
    x * ratio,
    y * ratio,
    drawWidth * ratio,
    drawHeight * ratio,
  );

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result);
        else reject(new Error('Failed to compress image'));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });

  return new File([blob], 'person-photo.jpg', { type: 'image/jpeg' });
}

export const PERSON_PHOTO_OUTPUT = {
  size: OUTPUT_SIZE,
  quality: JPEG_QUALITY,
  format: 'image/jpeg' as const,
};
