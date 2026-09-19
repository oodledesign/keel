import { describe, expect, it } from 'vitest';

import {
  CompressUploadImageError,
  fileExtension,
  formatUploadMegabytes,
  isAllowedUploadImage,
  isHeicLikeFile,
  jpegFileName,
  uploadImageTargetDimensions,
} from './compress-upload-image';

describe('uploadImageTargetDimensions', () => {
  it('leaves images within the long-edge cap unchanged', () => {
    expect(uploadImageTargetDimensions(1600, 1200, 2048)).toEqual({
      width: 1600,
      height: 1200,
      scaled: false,
    });
  });

  it('scales iPhone photos down to the long-edge cap', () => {
    expect(uploadImageTargetDimensions(4032, 3024, 2048)).toEqual({
      width: 2048,
      height: 1536,
      scaled: true,
    });
  });

  it('scales tall phone screenshots by height', () => {
    expect(uploadImageTargetDimensions(1290, 2796, 2048)).toEqual({
      width: 945,
      height: 2048,
      scaled: true,
    });
  });
});

describe('isHeicLikeFile', () => {
  it('detects HEIC from mime or extension', () => {
    expect(isHeicLikeFile({ type: 'image/heic', name: 'IMG_1.JPG' })).toBe(
      true,
    );
    expect(isHeicLikeFile({ type: '', name: 'IMG_1.HEIC' })).toBe(true);
    expect(isHeicLikeFile({ type: 'image/heif', name: 'photo' })).toBe(true);
    expect(isHeicLikeFile({ type: 'image/jpeg', name: 'photo.jpg' })).toBe(
      false,
    );
  });
});

describe('isAllowedUploadImage', () => {
  it('accepts common phone formats including empty-type HEIC', () => {
    expect(isAllowedUploadImage({ type: 'image/jpeg', name: 'a.jpg' })).toBe(
      true,
    );
    expect(isAllowedUploadImage({ type: 'image/png', name: 'shot.png' })).toBe(
      true,
    );
    expect(isAllowedUploadImage({ type: 'image/heic', name: 'IMG_1' })).toBe(
      true,
    );
    expect(isAllowedUploadImage({ type: '', name: 'IMG_1.heic' })).toBe(true);
  });

  it('rejects SVG and non-images', () => {
    expect(
      isAllowedUploadImage({ type: 'image/svg+xml', name: 'icon.svg' }),
    ).toBe(false);
    expect(
      isAllowedUploadImage({ type: 'application/pdf', name: 'doc.pdf' }),
    ).toBe(false);
    expect(isAllowedUploadImage({ type: '', name: 'notes.txt' })).toBe(false);
  });
});

describe('compressUploadImageFile preflight', () => {
  it('rejects originals over the hard ceiling before canvas work', async () => {
    const { compressUploadImageFile } = await import('./compress-upload-image');
    const file = {
      name: 'huge.jpg',
      type: 'image/jpeg',
      size: 26 * 1024 * 1024,
    } as File;

    await expect(compressUploadImageFile(file)).rejects.toMatchObject({
      code: 'too_large',
    });
  });

  it('rejects non-images and empty files', async () => {
    const { compressUploadImageFile } = await import('./compress-upload-image');

    await expect(
      compressUploadImageFile({
        name: 'notes.pdf',
        type: 'application/pdf',
        size: 100,
      } as File),
    ).rejects.toMatchObject({ code: 'unsupported' });

    await expect(
      compressUploadImageFile({
        name: 'empty.jpg',
        type: 'image/jpeg',
        size: 0,
      } as File),
    ).rejects.toMatchObject({ code: 'unreadable' });
  });
});

describe('helpers', () => {
  it('formats megabyte caps without trailing zeros', () => {
    expect(formatUploadMegabytes(25 * 1024 * 1024)).toBe('25');
    expect(formatUploadMegabytes(1_500_000)).toBe('1.4');
  });

  it('rewrites names to jpg', () => {
    expect(jpegFileName('Screenshot 2026-09-19.png')).toBe(
      'Screenshot 2026-09-19.jpg',
    );
    expect(jpegFileName('IMG_1234.HEIC')).toBe('IMG_1234.jpg');
    expect(fileExtension('IMG_1234.HEIC')).toBe('heic');
  });

  it('is an Error subclass with a stable code', () => {
    const error = new CompressUploadImageError('too_large', 'too big');
    expect(error).toBeInstanceOf(Error);
    expect(error.code).toBe('too_large');
  });
});
