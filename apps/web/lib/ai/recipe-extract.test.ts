import { describe, expect, it } from 'vitest';

import { collectRecipeImageCandidates } from '~/lib/ai/recipe-extract-images';
import {
  attachExtractSource,
  emptyRecipeDraft,
  isInstagramRecipeUrl,
  isPrivateOrLocalUrl,
  isoDurationToMinutes,
  mapSchemaOrgRecipe,
  parseInstagramOembedJson,
} from '~/lib/ai/recipe-extract-utils';

describe('isoDurationToMinutes', () => {
  it('parses common ISO-8601 cook times', () => {
    expect(isoDurationToMinutes('PT45M')).toBe(45);
    expect(isoDurationToMinutes('PT1H30M')).toBe(90);
    expect(isoDurationToMinutes('PT2H')).toBe(120);
    expect(isoDurationToMinutes('P1DT2H')).toBe(1560);
  });

  it('returns null for invalid values', () => {
    expect(isoDurationToMinutes(null)).toBeNull();
    expect(isoDurationToMinutes('45 minutes')).toBeNull();
    expect(isoDurationToMinutes('')).toBeNull();
  });
});

describe('isPrivateOrLocalUrl', () => {
  it('rejects short-form private IPs that Linux would resolve', () => {
    expect(isPrivateOrLocalUrl('http://127.1/cover.jpg')).toBe(true);
    expect(isPrivateOrLocalUrl('http://10.1/cover.jpg')).toBe(true);
    expect(isPrivateOrLocalUrl('http://192.168.1/cover.jpg')).toBe(true);
    expect(isPrivateOrLocalUrl('https://cdn.example.com/og.jpg')).toBe(false);
  });
});

describe('isInstagramRecipeUrl', () => {
  it('accepts post and reel links', () => {
    expect(isInstagramRecipeUrl('https://www.instagram.com/p/AbCdEf123/')).toBe(
      true,
    );
    expect(
      isInstagramRecipeUrl('https://instagram.com/reel/AbCdEf123/?igsh=1'),
    ).toBe(true);
  });

  it('rejects non-recipe Instagram paths', () => {
    expect(isInstagramRecipeUrl('https://www.instagram.com/explore/')).toBe(
      false,
    );
    expect(isInstagramRecipeUrl('https://example.com/p/x')).toBe(false);
  });
});

describe('mapSchemaOrgRecipe', () => {
  it('maps a schema.org Recipe object into family_recipes draft fields', () => {
    const draft = mapSchemaOrgRecipe({
      '@type': 'Recipe',
      name: 'Lemon chicken',
      description: 'Weeknight favourite',
      recipeIngredient: ['4 chicken thighs', '1 lemon'],
      recipeInstructions: [
        { '@type': 'HowToStep', text: 'Season the chicken' },
        { '@type': 'HowToStep', text: 'Roast for 35 minutes' },
      ],
      recipeCuisine: 'Mediterranean',
      recipeCategory: 'Dinner',
      prepTime: 'PT15M',
      cookTime: 'PT35M',
      recipeYield: '4 servings',
    });

    expect(draft).toMatchObject({
      name: 'Lemon chicken',
      description: 'Weeknight favourite',
      ingredients: ['4 chicken thighs', '1 lemon'],
      meal_type: 'dinner',
      prep_minutes: 15,
      cook_minutes: 35,
      servings: 4,
      is_favorite: false,
      source: 'ai',
    });
    expect(draft?.instructions).toContain('Season the chicken');
    expect(draft?.tags).toEqual(
      expect.arrayContaining(['Mediterranean', 'Dinner']),
    );
  });
});

describe('Instagram oembed extract', () => {
  it('attaches thumbnail_url and source_url to the review draft', () => {
    const oembed = parseInstagramOembedJson({
      title: 'One-pan lemon pasta',
      author_name: 'dan',
      thumbnail_url: 'https://scontent.cdninstagram.com/v/t51.123/cover.jpg',
    });

    expect(oembed.caption).toContain('One-pan lemon pasta');
    expect(oembed.thumbnailUrl).toBe(
      'https://scontent.cdninstagram.com/v/t51.123/cover.jpg',
    );

    const draft = attachExtractSource(emptyRecipeDraft(), {
      sourceUrl: 'https://www.instagram.com/reel/AbCdEf123/',
      candidates: oembed.thumbnailUrl
        ? [{ url: oembed.thumbnailUrl, source: 'oembed' }]
        : [],
    });

    expect(draft.source_url).toBe('https://www.instagram.com/reel/AbCdEf123/');
    expect(draft.image_url).toBe(oembed.thumbnailUrl);
    expect(draft.image_candidates).toEqual([
      { url: oembed.thumbnailUrl, source: 'oembed' },
    ]);
  });

  it('still saves the source link when oembed has no thumbnail', () => {
    const oembed = parseInstagramOembedJson({
      title: 'Caption only',
      author_name: 'dan',
    });

    const draft = attachExtractSource(emptyRecipeDraft(), {
      sourceUrl: 'https://www.instagram.com/p/AbCdEf123/',
      candidates: oembed.thumbnailUrl
        ? [{ url: oembed.thumbnailUrl, source: 'oembed' }]
        : [],
    });

    expect(draft.source_url).toBe('https://www.instagram.com/p/AbCdEf123/');
    expect(draft.image_url).toBeNull();
    expect(draft.image_candidates).toEqual([]);
  });
});

describe('collectRecipeImageCandidates', () => {
  it('lists og:image and schema.org Recipe.image (plus large content images)', () => {
    const html = `<!doctype html>
      <html>
        <head>
          <meta property="og:image" content="https://cdn.example.com/og-cover.jpg" />
          <script type="application/ld+json">
            {
              "@context": "https://schema.org",
              "@type": "Recipe",
              "name": "Lemon chicken",
              "image": "https://cdn.example.com/schema-hero.jpg"
            }
          </script>
        </head>
        <body>
          <article>
            <img src="/photos/plating.jpg" width="1200" height="800" />
            <img src="/favicon.ico" width="32" height="32" />
          </article>
        </body>
      </html>`;

    const candidates = collectRecipeImageCandidates(
      html,
      'https://example.com/recipes/lemon-chicken',
    );

    expect(candidates).toEqual(
      expect.arrayContaining([
        {
          source: 'og',
          url: 'https://cdn.example.com/og-cover.jpg',
        },
        {
          source: 'schema',
          url: 'https://cdn.example.com/schema-hero.jpg',
        },
        {
          source: 'content',
          url: 'https://example.com/photos/plating.jpg',
        },
      ]),
    );
    expect(candidates.some((item) => item.url.includes('favicon'))).toBe(false);
    expect(candidates[0]?.source).toBe('og');
  });
});
