import { describe, expect, it } from 'vitest';

import {
  buildExtractWarnings,
  canonicalizeSourceUrl,
  cleanRecipeTitle,
  describeHttpFetchError,
  extractMethodLabel,
  instagramCaptionLooksThin,
  isInstagramRecipePath,
  looksLikePaywalledHtml,
  parseServingsValue,
  sourceUrlsMatch,
  tidyIngredientLines,
  tidyInstructionText,
} from '~/lib/ai/recipe-import-polish';

describe('canonicalizeSourceUrl', () => {
  it('strips tracking params and trailing slashes', () => {
    expect(
      canonicalizeSourceUrl(
        'https://www.bbcgoodfood.com/recipes/lemon-chicken/?utm_source=ig&utm_medium=social',
      ),
    ).toBe('https://www.bbcgoodfood.com/recipes/lemon-chicken');
  });

  it('rewrites Instagram share and reels URLs to a canonical post', () => {
    expect(
      canonicalizeSourceUrl('https://www.instagram.com/share/reel/AbCdEf123/'),
    ).toBe('https://www.instagram.com/reel/AbCdEf123/');
    expect(
      canonicalizeSourceUrl('https://instagram.com/reels/AbCdEf123/?igsh=xyz'),
    ).toBe('https://www.instagram.com/reel/AbCdEf123/');
    expect(
      canonicalizeSourceUrl('https://www.instagram.com/share/p/AbCdEf123'),
    ).toBe('https://www.instagram.com/p/AbCdEf123/');
  });
});

describe('sourceUrlsMatch', () => {
  it('treats www, trailing slash, and utm as the same recipe', () => {
    expect(
      sourceUrlsMatch(
        'https://www.bbcgoodfood.com/recipes/lemon-chicken/',
        'https://bbcgoodfood.com/recipes/lemon-chicken?utm_source=share',
      ),
    ).toBe(true);
    expect(
      sourceUrlsMatch(
        'https://www.instagram.com/reel/AbCdEf123/?igsh=1',
        'https://instagram.com/share/reel/AbCdEf123',
      ),
    ).toBe(true);
  });
});

describe('isInstagramRecipePath', () => {
  it('accepts share and reels paths', () => {
    expect(
      isInstagramRecipePath('https://www.instagram.com/share/reel/AbCdEf123/'),
    ).toBe(true);
    expect(isInstagramRecipePath('https://instagram.com/reels/AbCdEf123')).toBe(
      true,
    );
  });
});

describe('parseServingsValue', () => {
  it('uses the lower bound of a range', () => {
    expect(parseServingsValue('Serves 4-6')).toBe(4);
    expect(parseServingsValue('4 to 6 people')).toBe(4);
    expect(parseServingsValue('makes 12 cookies')).toBe(12);
  });
});

describe('cleanRecipeTitle', () => {
  it('strips site suffixes and a Recipe: prefix', () => {
    expect(cleanRecipeTitle('Lemon chicken | BBC Good Food')).toBe(
      'Lemon chicken',
    );
    expect(cleanRecipeTitle('Recipe: Lemon chicken', 'NYT Cooking')).toBe(
      'Lemon chicken',
    );
    expect(cleanRecipeTitle('Lemon chicken - NYT Cooking')).toBe(
      'Lemon chicken',
    );
  });
});

describe('tidyIngredientLines', () => {
  it('splits packed lines, drops junk, and dedupes', () => {
    expect(
      tidyIngredientLines([
        '200g pasta • 2 tbsp olive oil',
        'Advertisement',
        '200g pasta',
        'Print recipe',
        '1 lemon',
      ]),
    ).toEqual(['200g pasta', '2 tbsp olive oil', '1 lemon']);
  });
});

describe('tidyInstructionText', () => {
  it('drops junk steps and re-numbers', () => {
    expect(
      tidyInstructionText(
        '1. Season the chicken\nJump to recipe\n2. Roast for 35 minutes\nSubscribe',
      ),
    ).toBe('1. Season the chicken\n2. Roast for 35 minutes');
  });
});

describe('looksLikePaywalledHtml', () => {
  it('detects common paywall copy', () => {
    expect(
      looksLikePaywalledHtml(
        '<html><body>Subscribe to continue reading this recipe</body></html>',
      ),
    ).toBe(true);
    expect(
      looksLikePaywalledHtml('<html><article><h1>Lemon chicken</h1></article>'),
    ).toBe(false);
  });
});

describe('describeHttpFetchError', () => {
  it('suggests paste or retry for blocked pages', () => {
    expect(describeHttpFetchError(403)).toMatch(/Paste the recipe text/);
    expect(describeHttpFetchError(404)).toMatch(/could not be found/i);
  });
});

describe('instagramCaptionLooksThin', () => {
  it('flags video-only captions', () => {
    expect(instagramCaptionLooksThin('Dinner tonight 🍝')).toBe(true);
    expect(
      instagramCaptionLooksThin(
        'Lemon pasta\n\nIngredients\n200g pasta\n2 tbsp olive oil\n\nMethod\nBoil the pasta.',
      ),
    ).toBe(false);
  });
});

describe('buildExtractWarnings', () => {
  it('asks the user to paste missing ingredients', () => {
    const warnings = buildExtractWarnings({
      ingredients: [],
      instructions: 'Boil pasta',
      servings: 4,
    });
    expect(warnings[0]?.code).toBe('missing_ingredients');
    expect(warnings[0]?.message).toMatch(/paste/i);
  });
});

describe('extractMethodLabel', () => {
  it('labels schema and caption methods', () => {
    expect(extractMethodLabel('schema_org')).toMatch(/page/i);
    expect(extractMethodLabel('instagram_caption')).toMatch(/Instagram/);
  });
});
