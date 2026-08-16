export type RecipeExtractMethod =
  | 'llm_text'
  | 'llm_image'
  | 'schema_org'
  | 'instagram_caption';

export type RecipeExtractSource = 'text' | 'image' | 'url';

export type { ExtractedRecipeDraft } from '~/lib/ai/recipe-extract-utils';
