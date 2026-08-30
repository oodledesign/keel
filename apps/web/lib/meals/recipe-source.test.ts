import { describe, expect, it } from 'vitest';

import {
  RecipeInputSchema,
  toRecipeWriteValues,
} from '~/home/(user)/life/family/_lib/schema/family-meal.schema';

describe('source_url save round-trip', () => {
  it('persists an Instagram/page URL through parse → write → parse', () => {
    const parsed = RecipeInputSchema.parse({
      name: 'Lemon chicken',
      source: 'instagram',
      source_label: 'Instagram',
      source_url: 'https://www.instagram.com/reel/AbCdEf123/',
    });

    const written = toRecipeWriteValues(parsed);
    expect(written.source_url).toBe(
      'https://www.instagram.com/reel/AbCdEf123/',
    );
    expect(written.source_label).toBe('Instagram');
    expect(parsed.source).toBe('instagram');

    const again = RecipeInputSchema.parse({
      name: written.name,
      source: 'instagram',
      source_label: written.source_label,
      source_url: written.source_url,
    });
    expect(again.source_url).toBe(written.source_url);
    expect(again.source_label).toBe('Instagram');
    expect(toRecipeWriteValues(again).source_url).toBe(written.source_url);
  });

  it('persists a website source label instead of ai', () => {
    const parsed = RecipeInputSchema.parse({
      name: 'Lemon chicken',
      source: 'website',
      source_label: 'BBC Good Food',
      source_url: 'https://www.bbcgoodfood.com/recipes/lemon-chicken',
    });
    expect(parsed.source).toBe('website');
    expect(toRecipeWriteValues(parsed).source_label).toBe('BBC Good Food');
  });

  it('treats a blank source link as null so manual recipes stay link-free', () => {
    const parsed = RecipeInputSchema.parse({
      name: 'Handwritten stew',
      source_url: '   ',
    });
    expect(parsed.source_url ?? null).toBeNull();
    expect(toRecipeWriteValues(parsed).source_url).toBeNull();
  });

  it('rejects non-http source URLs', () => {
    const result = RecipeInputSchema.safeParse({
      name: 'Bad link',
      source_url: 'javascript:alert(1)',
    });
    expect(result.success).toBe(false);
  });
});
