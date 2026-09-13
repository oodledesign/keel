import { z } from 'zod';

export const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const RECIPE_MEAL_TYPES = [...MEAL_TYPES, 'any'] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

export const RECIPE_SOURCES = ['manual', 'ai', 'instagram', 'website'] as const;
export type RecipeSource = (typeof RECIPE_SOURCES)[number];

/** Generator priorities the user can toggle (healthy, quick, cheap, etc.). */
export const PRIORITY_OPTIONS = [
  'healthy',
  'quick',
  'cheap',
  'high-protein',
  'low-carb',
  'kid-friendly',
  'batch-cook',
  'minimal-washing-up',
] as const;
export type PriorityOption = (typeof PRIORITY_OPTIONS)[number];

/** Common dietary requirements. The UI also allows free-text additions. */
export const DIETARY_OPTIONS = [
  'vegetarian',
  'vegan',
  'pescatarian',
  'gluten-free',
  'dairy-free',
  'nut-free',
  'halal',
  'kosher',
  'low-sugar',
] as const;
export type DietaryOption = (typeof DIETARY_OPTIONS)[number];

export const AccountSlugFieldSchema = z.object({
  accountSlug: z.string().min(1).optional(),
});

const emptyToNull = (value: unknown) => {
  if (value == null) return null;
  if (typeof value === 'string' && !value.trim()) return null;
  return value;
};

export const RecipeHttpUrlSchema = z.preprocess(
  emptyToNull,
  z
    .string()
    .trim()
    .max(2_000)
    .refine((value) => {
      try {
        const parsed = new URL(value);
        return parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        return false;
      }
    }, 'Must be an http or https URL')
    .nullable()
    .optional(),
);

export type RecipeRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  description: string | null;
  ingredients: string[];
  instructions: string | null;
  tags: string[];
  meal_type: RecipeMealType;
  prep_minutes: number | null;
  cook_minutes: number | null;
  servings: number | null;
  is_favorite: boolean;
  source: RecipeSource;
  source_label: string | null;
  source_url: string | null;
  image_url: string | null;
  calories_per_serving: number | null;
  protein_g: number | null;
  carbs_g: number | null;
  fat_g: number | null;
  diet_tags: string[];
  nutrition_computed_at: string | null;
  nutrition_pending: boolean;
  prep_ingredients_hash: string | null;
  public_share_enabled: boolean;
  public_share_token: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeBookRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  description: string | null;
  public_share_enabled: boolean;
  public_share_token: string | null;
  last_edited_by: string | null;
  last_edited_name: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeBookItemRow = {
  id: string;
  book_id: string;
  recipe_id: string;
  sort_order: number;
  created_at: string;
};

export type RecipeBookWithRecipes = RecipeBookRow & {
  recipe_ids: string[];
  recipe_count: number;
};

export type MealPreferencesRow = {
  id?: string;
  user_id: string;
  account_id: string | null;
  dietary_requirements: string[];
  priorities: string[];
  disliked_ingredients: string[];
  household_size: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type MealEntryRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  plan_date: string;
  meal_type: MealType;
  recipe_id: string | null;
  title: string;
  notes: string | null;
  cook_member_id: string | null;
  is_batch_prep: boolean;
  leftover_source_entry_id: string | null;
  created_at: string;
  updated_at: string;
};

export type HouseholdMemberRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  display_name: string;
  member_user_id: string | null;
  dietary_tags: string[];
  excluded_ingredients: string[];
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type PantryItemRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  normalized_name: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type RecipeCookStats = {
  recipe_id: string;
  times_cooked: number;
  last_cooked_at: string | null;
};

export const RecipeInputSchema = AccountSlugFieldSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: z.string().trim().max(1_000).optional().nullable(),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(80).default([]),
  instructions: z.string().trim().max(8_000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  meal_type: z.enum(RECIPE_MEAL_TYPES).default('dinner'),
  prep_minutes: z.number().int().min(0).max(1_440).optional().nullable(),
  cook_minutes: z.number().int().min(0).max(1_440).optional().nullable(),
  servings: z.number().int().min(1).max(50).optional().nullable(),
  is_favorite: z.boolean().default(false),
  source: z.enum(RECIPE_SOURCES).optional(),
  source_label: z.string().trim().max(80).nullable().optional(),
  source_url: RecipeHttpUrlSchema,
  /** Existing account_image URL to keep when editing. */
  image_url: z.string().trim().max(2_000).nullable().optional(),
  /** Remote candidate (Instagram thumbnail / page image) to copy into storage. */
  remote_image_url: RecipeHttpUrlSchema,
  /** User-uploaded data URL to copy into storage. */
  image_data: z.string().max(6_000_000).nullable().optional(),
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

/** Persistable family_recipes columns from a reviewed RecipeInput (no image copy). */
export function toRecipeWriteValues(parsed: RecipeInput) {
  return {
    name: parsed.name,
    description: parsed.description ?? null,
    ingredients: parsed.ingredients,
    instructions: parsed.instructions ?? null,
    tags: parsed.tags,
    meal_type: parsed.meal_type,
    prep_minutes: parsed.prep_minutes ?? null,
    cook_minutes: parsed.cook_minutes ?? null,
    servings: parsed.servings ?? null,
    is_favorite: parsed.is_favorite,
    source_url: parsed.source_url ?? null,
    source_label: parsed.source_label?.trim() || null,
  };
}

export const MealPreferencesInputSchema = AccountSlugFieldSchema.extend({
  dietary_requirements: z
    .array(z.string().trim().min(1).max(60))
    .max(40)
    .default([]),
  priorities: z.array(z.string().trim().min(1).max(60)).max(40).default([]),
  disliked_ingredients: z
    .array(z.string().trim().min(1).max(60))
    .max(60)
    .default([]),
  household_size: z.number().int().min(1).max(30).default(2),
  notes: z.string().trim().max(2_000).optional().nullable(),
});
export type MealPreferencesInput = z.infer<typeof MealPreferencesInputSchema>;

export const SetMealEntrySchema = AccountSlugFieldSchema.extend({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES).default('dinner'),
  title: z.string().trim().max(200).default(''),
  recipeId: z.string().uuid().optional().nullable(),
  notes: z.string().trim().max(1_000).optional().nullable(),
  cookMemberId: z.string().uuid().optional().nullable(),
  isBatchPrep: z.boolean().optional(),
  leftoverSourceEntryId: z.string().uuid().optional().nullable(),
});
export type SetMealEntryInput = z.infer<typeof SetMealEntrySchema>;

export const HouseholdMemberInputSchema = AccountSlugFieldSchema.extend({
  id: z.string().uuid().optional(),
  displayName: z.string().trim().min(1).max(80),
  dietaryTags: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
  excludedIngredients: z
    .array(z.string().trim().min(1).max(60))
    .max(40)
    .default([]),
});
export type HouseholdMemberInput = z.infer<typeof HouseholdMemberInputSchema>;

export const DeleteHouseholdMemberSchema = AccountSlugFieldSchema.extend({
  memberId: z.string().uuid(),
});
export type DeleteHouseholdMemberInput = z.infer<
  typeof DeleteHouseholdMemberSchema
>;

export const PantryItemInputSchema = AccountSlugFieldSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  notes: z.string().trim().max(400).optional().nullable(),
});
export type PantryItemInput = z.infer<typeof PantryItemInputSchema>;

export const DeletePantryItemSchema = AccountSlugFieldSchema.extend({
  itemId: z.string().uuid(),
});
export type DeletePantryItemInput = z.infer<typeof DeletePantryItemSchema>;

export const ApplyLeftoversSchema = AccountSlugFieldSchema.extend({
  sourceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES).default('dinner'),
  targetDates: z
    .array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/))
    .min(1)
    .max(7),
});
export type ApplyLeftoversInput = z.infer<typeof ApplyLeftoversSchema>;

export const ClearMealEntrySchema = AccountSlugFieldSchema.extend({
  planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  mealType: z.enum(MEAL_TYPES).default('dinner'),
});
export type ClearMealEntryInput = z.infer<typeof ClearMealEntrySchema>;

export const ApplyGeneratedWeekSchema = AccountSlugFieldSchema.extend({
  entries: z
    .array(
      z.object({
        planDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        mealType: z.enum(MEAL_TYPES).default('dinner'),
        title: z.string().trim().min(1).max(200),
        notes: z.string().trim().max(1_000).optional().nullable(),
        recipeId: z.string().uuid().optional().nullable(),
      }),
    )
    .min(1)
    .max(31),
});
export type ApplyGeneratedWeekInput = z.infer<typeof ApplyGeneratedWeekSchema>;

export type MealPlanView = 'week' | 'month';

export const DeleteRecipeSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
});
export type DeleteRecipeInput = z.infer<typeof DeleteRecipeSchema>;

export const ToggleRecipeFavoriteSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
  isFavorite: z.boolean(),
});
export type ToggleRecipeFavoriteInput = z.infer<
  typeof ToggleRecipeFavoriteSchema
>;

export const LogRecipeCookSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
  rating: z.number().int().min(1).max(5).optional().nullable(),
  notes: z.string().trim().max(1_000).optional().nullable(),
  cookedAt: z.string().datetime().optional(),
});
export type LogRecipeCookInput = z.infer<typeof LogRecipeCookSchema>;

export type RecipeCookLogRow = {
  id: string;
  recipe_id: string;
  rating: number | null;
  cooked_at: string;
  notes: string | null;
  created_at: string;
};

export type RecipePopularityStats = {
  times_cooked: number;
  avg_rating: number | null;
  popularity_score: number;
};

export type RecipeIngredientRow = {
  id: string;
  recipe_id: string;
  sort_order: number;
  name: string;
  amount: number | null;
  unit: string | null;
  original_text: string;
};

export type RecipeStepRow = {
  id: string;
  recipe_id: string;
  sort_order: number;
  title: string;
  content: string;
  timer_seconds: number | null;
  /** ingredient_id → quantity_multiplier for this step */
  ingredient_multipliers: Record<string, number>;
};

export type RecipeStructure = {
  ingredients: RecipeIngredientRow[];
  steps: RecipeStepRow[];
};

export const GeneratedRecipeDraftSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(1_000).optional().nullable(),
  ingredients: z.array(z.string().trim().min(1).max(200)).max(80).default([]),
  instructions: z.string().trim().max(8_000).optional().nullable(),
  tags: z.array(z.string().trim().min(1).max(40)).max(20).default([]),
  meal_type: z.enum(RECIPE_MEAL_TYPES).default('dinner'),
  prep_minutes: z.number().int().min(0).max(1_440).optional().nullable(),
  cook_minutes: z.number().int().min(0).max(1_440).optional().nullable(),
  servings: z.number().int().min(1).max(50).optional().nullable(),
  inspiration: z.string().trim().max(300).optional().nullable(),
});

export const BulkAddGeneratedRecipesSchema = AccountSlugFieldSchema.extend({
  recipes: z.array(GeneratedRecipeDraftSchema).min(1).max(10),
});
export type BulkAddGeneratedRecipesInput = z.infer<
  typeof BulkAddGeneratedRecipesSchema
>;

export const SetRecipePublicShareSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
  enabled: z.boolean(),
});
export type SetRecipePublicShareInput = z.infer<
  typeof SetRecipePublicShareSchema
>;

export const RotateRecipeShareTokenSchema = AccountSlugFieldSchema.extend({
  recipeId: z.string().uuid(),
});
export type RotateRecipeShareTokenInput = z.infer<
  typeof RotateRecipeShareTokenSchema
>;

export const RecipeBookInputSchema = AccountSlugFieldSchema.extend({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: z.string().trim().max(2_000).optional().nullable(),
  recipeIds: z.array(z.string().uuid()).max(80).default([]),
});
export type RecipeBookInput = z.infer<typeof RecipeBookInputSchema>;

export const DeleteRecipeBookSchema = AccountSlugFieldSchema.extend({
  bookId: z.string().uuid(),
});
export type DeleteRecipeBookInput = z.infer<typeof DeleteRecipeBookSchema>;

export const SetRecipeBookPublicShareSchema = AccountSlugFieldSchema.extend({
  bookId: z.string().uuid(),
  enabled: z.boolean(),
});
export type SetRecipeBookPublicShareInput = z.infer<
  typeof SetRecipeBookPublicShareSchema
>;

export const RotateRecipeBookShareTokenSchema = AccountSlugFieldSchema.extend({
  bookId: z.string().uuid(),
});
export type RotateRecipeBookShareTokenInput = z.infer<
  typeof RotateRecipeBookShareTokenSchema
>;

export type FamilyMealData = {
  recipes: RecipeRow[];
  books: RecipeBookWithRecipes[];
  preferences: MealPreferencesRow;
  members: HouseholdMemberRow[];
  pantry: PantryItemRow[];
  cookStats: RecipeCookStats[];
  accountSlug?: string;
  basePath: string;
  view: MealPlanView;
  /** Active week (Mon) when view=week, or the month’s first day when view=month. */
  periodStart: string;
  /** Dates shown in the planner (7 days or full month). */
  planDates: string[];
  monthKey: string;
  weekStart: string;
  weekDates: string[];
  entries: MealEntryRow[];
  hasShoppingListForWeek: boolean;
};
