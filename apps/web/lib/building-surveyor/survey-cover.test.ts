import { describe, expect, it } from 'vitest';

import {
  COVER_FRAME,
  DEFAULT_COVER_FOCUS,
  coverImageFolder,
  coverPlacement,
  isCoverImagePath,
  looksLikeImage,
  mapSurveyCoverPhotoDocId,
  parseCoverFocus,
  surveyCoverSource,
} from './survey-cover';

const ACCOUNT = '11111111-1111-4111-8111-111111111111';

describe('surveyCoverSource', () => {
  it('prefers the survey photo, then the default image, then the first photo', () => {
    expect(
      surveyCoverSource({ photoDocId: 'doc-1', hasDefaultImage: true }),
    ).toBe('photo');
    expect(surveyCoverSource({ photoDocId: null, hasDefaultImage: true })).toBe(
      'default',
    );
    expect(
      surveyCoverSource({ photoDocId: undefined, hasDefaultImage: false }),
    ).toBe('first_photo');
  });
});

describe('isCoverImagePath', () => {
  it('only accepts files inside the account cover folder', () => {
    expect(isCoverImagePath(ACCOUNT, `${coverImageFolder(ACCOUNT)}a.jpg`)).toBe(
      true,
    );
    expect(isCoverImagePath(ACCOUNT, coverImageFolder(ACCOUNT))).toBe(false);
    expect(isCoverImagePath(ACCOUNT, `${ACCOUNT}/other/a.jpg`)).toBe(false);
    expect(isCoverImagePath(ACCOUNT, 'other-account/survey-cover/a.jpg')).toBe(
      false,
    );
    expect(
      isCoverImagePath(ACCOUNT, `${coverImageFolder(ACCOUNT)}../x.jpg`),
    ).toBe(false);
  });
});

describe('mapSurveyCoverPhotoDocId', () => {
  it('returns null for missing or empty values', () => {
    expect(mapSurveyCoverPhotoDocId({})).toBeNull();
    expect(
      mapSurveyCoverPhotoDocId({ survey_cover_photo_doc_id: '' }),
    ).toBeNull();
    expect(mapSurveyCoverPhotoDocId({ survey_cover_photo_doc_id: 'abc' })).toBe(
      'abc',
    );
  });
});

describe('looksLikeImage', () => {
  it('accepts JPEG, PNG and WebP headers and rejects other data', () => {
    expect(looksLikeImage(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(
      true,
    );
    expect(looksLikeImage(Uint8Array.from([0x89, 0x50, 0x4e, 0x47]))).toBe(
      true,
    );
    expect(
      looksLikeImage(
        Uint8Array.from([
          0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50,
        ]),
      ),
    ).toBe(true);
    expect(looksLikeImage(new TextEncoder().encode('<svg></svg>'))).toBe(false);
  });
});

describe('parseCoverFocus', () => {
  it('falls back to the centre for missing or invalid values', () => {
    expect(parseCoverFocus(null)).toEqual(DEFAULT_COVER_FOCUS);
    expect(parseCoverFocus({ x: 'a', y: 0, zoom: 1 })).toEqual(
      DEFAULT_COVER_FOCUS,
    );
    expect(parseCoverFocus({ x: NaN, y: 0, zoom: 1 })).toEqual(
      DEFAULT_COVER_FOCUS,
    );
  });

  it('clamps out-of-range values', () => {
    expect(parseCoverFocus({ x: -1, y: 4, zoom: 9 })).toEqual({
      x: 0,
      y: 1,
      zoom: 3,
    });
  });
});

describe('coverPlacement', () => {
  const landscape = { width: 1600, height: 1200 };

  it('covers the frame and centres a landscape photo by default', () => {
    const placement = coverPlacement(landscape, DEFAULT_COVER_FOCUS);
    expect(placement.height).toBeCloseTo(COVER_FRAME.height);
    expect(placement.width).toBeGreaterThan(COVER_FRAME.width);
    expect(placement.offsetY).toBeCloseTo(0);
    expect(placement.offsetX).toBeCloseTo(-placement.overflowX / 2);
  });

  it('moves the window to the left and right edges', () => {
    const left = coverPlacement(landscape, { x: 0, y: 0.5, zoom: 1 });
    const right = coverPlacement(landscape, { x: 1, y: 0.5, zoom: 1 });
    expect(left.offsetX).toBeCloseTo(0);
    expect(right.offsetX + right.width).toBeCloseTo(COVER_FRAME.width);
  });

  it('zooming enlarges the image and opens up vertical movement', () => {
    const zoomed = coverPlacement(landscape, { x: 0.5, y: 1, zoom: 2 });
    expect(zoomed.height).toBeCloseTo(COVER_FRAME.height * 2);
    expect(zoomed.offsetY + zoomed.height).toBeCloseTo(COVER_FRAME.height);
  });
});
