import { describe, expect, it } from 'vitest';

import {
  buildPublicRecipeBookSharePath,
  buildPublicRecipeBookShareUrl,
  buildPublicRecipeSharePath,
  buildPublicRecipeShareUrl,
  isUsableShareToken,
} from './public-recipe-share';

describe('public recipe share URLs', () => {
  it('builds recipe and book paths from tokens', () => {
    expect(buildPublicRecipeSharePath('tok-aaaaaaaaaaaaaaaa')).toBe(
      '/share/recipe/tok-aaaaaaaaaaaaaaaa',
    );
    expect(buildPublicRecipeBookSharePath('tok-bbbbbbbbbbbbbbbb')).toBe(
      '/share/recipe-book/tok-bbbbbbbbbbbbbbbb',
    );
  });

  it('prefixes the site origin when building absolute URLs', () => {
    expect(
      buildPublicRecipeShareUrl('tok-aaaaaaaaaaaaaaaa', 'https://app.ozer.so/'),
    ).toBe('https://app.ozer.so/share/recipe/tok-aaaaaaaaaaaaaaaa');
    expect(
      buildPublicRecipeBookShareUrl(
        'tok-bbbbbbbbbbbbbbbb',
        'https://app.ozer.so',
      ),
    ).toBe('https://app.ozer.so/share/recipe-book/tok-bbbbbbbbbbbbbbbb');
  });

  it('rejects short or empty tokens', () => {
    expect(isUsableShareToken(null)).toBe(false);
    expect(isUsableShareToken('short')).toBe(false);
    expect(isUsableShareToken('1234567890123456')).toBe(true);
  });
});
