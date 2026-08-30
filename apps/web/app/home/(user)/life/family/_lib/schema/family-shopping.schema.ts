import { z } from 'zod';

import { AccountSlugFieldSchema } from './family-meal.schema';

export const SHOPPING_CATEGORIES = [
  'produce',
  'meat_fish',
  'dairy',
  'store_cupboard',
  'other',
] as const;

export type ShoppingListCategory = (typeof SHOPPING_CATEGORIES)[number];

export type ShoppingListItemRow = {
  id: string;
  list_id: string;
  sort_order: number;
  name: string;
  amount: number | null;
  unit: string | null;
  category: ShoppingListCategory;
  display_text: string;
  is_unparsed: boolean;
  checked: boolean;
  created_at: string;
  updated_at: string;
};

export type ShoppingListRow = {
  id: string;
  user_id: string;
  account_id: string | null;
  week_start: string;
  skipped_meals: string[];
  generated_at: string;
  created_at: string;
  updated_at: string;
};

export type ShoppingListWithItems = ShoppingListRow & {
  items: ShoppingListItemRow[];
};

export const GenerateShoppingListSchema = AccountSlugFieldSchema.extend({
  weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  replaceExisting: z.boolean().default(false),
});
export type GenerateShoppingListInput = z.infer<
  typeof GenerateShoppingListSchema
>;

export const ToggleShoppingItemSchema = AccountSlugFieldSchema.extend({
  itemId: z.string().uuid(),
  checked: z.boolean(),
});
export type ToggleShoppingItemInput = z.infer<typeof ToggleShoppingItemSchema>;

export const AddShoppingItemSchema = AccountSlugFieldSchema.extend({
  listId: z.string().uuid().optional(),
  weekStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
  text: z.string().trim().min(1).max(200),
});
export type AddShoppingItemInput = z.infer<typeof AddShoppingItemSchema>;
