import { z } from 'zod';

export const MEAL_TYPES = [
  'breakfast',
  'lunch',
  'dinner',
  'snack',
] as const;
export type MealType = (typeof MEAL_TYPES)[number];

export const RECIPE_MEAL_TYPES = [...MEAL_TYPES, 'any'] as const;
export type RecipeMealType = (typeof RECIPE_MEAL_TYPES)[number];

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
  source: 'manual' | 'ai';
  created_at: string;
  updated_at: string;
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
  created_at: string;
  updated_at: string;
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
});
export type RecipeInput = z.infer<typeof RecipeInputSchema>;

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
});
export type SetMealEntryInput = z.infer<typeof SetMealEntrySchema>;

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

export type FamilyMealData = {
  recipes: RecipeRow[];
  preferences: MealPreferencesRow;
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
};
