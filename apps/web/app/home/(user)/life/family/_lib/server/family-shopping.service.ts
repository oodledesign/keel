import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { Database } from '~/lib/database.types';
import { parseIngredientLine } from '~/lib/meals/recipe-measurements';
import {
  type ShoppingIngredientInput,
  mergeShoppingIngredients,
  parseAndMergeIngredientLines,
  scaleShoppingIngredient,
} from '~/lib/meals/shopping-list-merge';

import type { MealEntryRow, RecipeRow } from '../schema/family-meal.schema';
import type {
  ShoppingListCategory,
  ShoppingListItemRow,
  ShoppingListRow,
  ShoppingListWithItems,
} from '../schema/family-shopping.schema';
import { addDays, weekDatesFrom } from './family-meal.dates';
import type { MealPlanScope } from './family-meal.scope';

type Client = SupabaseClient<Database>;

type QueryResult = {
  data: unknown;
  error: { message: string } | null;
};

type LooseFilter = PromiseLike<QueryResult> & {
  select: (cols?: string) => LooseFilter;
  insert: (rows: unknown) => LooseFilter;
  update: (rows: unknown) => LooseFilter;
  delete: () => LooseFilter;
  eq: (col: string, val: unknown) => LooseFilter;
  is: (col: string, val: unknown) => LooseFilter;
  in: (col: string, vals: readonly unknown[]) => LooseFilter;
  gte: (col: string, val: unknown) => LooseFilter;
  lte: (col: string, val: unknown) => LooseFilter;
  order: (col: string, opts?: { ascending?: boolean }) => LooseFilter;
  limit: (count: number) => LooseFilter;
  maybeSingle: () => Promise<QueryResult>;
  single: () => Promise<QueryResult>;
};

type LooseClient = {
  from: (table: string) => LooseFilter;
};

function loose(client: Client): LooseClient {
  return client as unknown as LooseClient;
}

function asNumber(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function mapList(row: Record<string, unknown>): ShoppingListRow {
  return {
    id: String(row.id),
    user_id: String(row.user_id),
    account_id: row.account_id == null ? null : String(row.account_id),
    week_start: String(row.week_start),
    skipped_meals: Array.isArray(row.skipped_meals)
      ? (row.skipped_meals as string[])
      : [],
    generated_at: String(row.generated_at),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function mapItem(row: Record<string, unknown>): ShoppingListItemRow {
  return {
    id: String(row.id),
    list_id: String(row.list_id),
    sort_order: Number(row.sort_order) || 0,
    name: String(row.name),
    amount: asNumber(row.amount as number | string | null),
    unit: row.unit == null ? null : String(row.unit),
    category: (row.category as ShoppingListCategory) ?? 'other',
    display_text: String(row.display_text),
    is_unparsed: Boolean(row.is_unparsed),
    checked: Boolean(row.checked),
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

function applyScope(query: LooseFilter, scope: MealPlanScope): LooseFilter {
  if (scope.kind === 'workspace') {
    return query.eq('account_id', scope.accountId);
  }
  return query.eq('user_id', scope.userId).is('account_id', null);
}

export function createFamilyShoppingService(client: Client) {
  return new FamilyShoppingService(client);
}

class FamilyShoppingService {
  constructor(private readonly client: Client) {}

  async findListForWeek(
    scope: MealPlanScope,
    weekStart: string,
  ): Promise<ShoppingListRow | null> {
    const db = loose(this.client);
    const { data, error } = await applyScope(
      db.from('family_shopping_lists').select('*'),
      scope,
    )
      .eq('week_start', weekStart)
      .maybeSingle();

    if (error) throw error;
    return data ? mapList(data as Record<string, unknown>) : null;
  }

  async loadLatestList(
    scope: MealPlanScope,
    weekStart?: string,
  ): Promise<ShoppingListWithItems | null> {
    const db = loose(this.client);
    let listQuery = applyScope(
      db.from('family_shopping_lists').select('*'),
      scope,
    ).order('generated_at', { ascending: false });

    if (weekStart) {
      listQuery = listQuery.eq('week_start', weekStart);
    }

    const { data, error } = await listQuery.limit(1).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const list = mapList(data as Record<string, unknown>);
    const items = await this.loadItems(list.id);
    return { ...list, items };
  }

  async loadItems(listId: string): Promise<ShoppingListItemRow[]> {
    const db = loose(this.client);
    const { data, error } = await db
      .from('family_shopping_list_items')
      .select('*')
      .eq('list_id', listId)
      .order('sort_order', { ascending: true });

    if (error) throw error;
    return ((data as Record<string, unknown>[] | null) ?? []).map(mapItem);
  }

  async generateFromWeek(input: {
    scope: MealPlanScope;
    weekStart: string;
    replaceExisting: boolean;
  }): Promise<
    | { status: 'exists'; list: ShoppingListRow }
    | {
        status: 'created';
        list: ShoppingListWithItems;
        replaced: boolean;
      }
    | { status: 'empty'; skippedMeals: string[] }
  > {
    const existing = await this.findListForWeek(input.scope, input.weekStart);
    if (existing && !input.replaceExisting) {
      return { status: 'exists', list: existing };
    }

    const weekDates = weekDatesFrom(input.weekStart);
    const rangeEnd = addDays(input.weekStart, 6);
    const { entries, recipes, structuredByRecipe, householdSize } =
      await this.loadWeekSources(input.scope, input.weekStart, rangeEnd);

    const collected: ShoppingIngredientInput[] = [];
    const skippedMeals: string[] = [];

    for (const date of weekDates) {
      const dayEntries = entries.filter((entry) => entry.plan_date === date);
      for (const entry of dayEntries) {
        if (!entry.recipe_id) {
          continue;
        }

        const recipe = recipes.get(entry.recipe_id);
        const structured = structuredByRecipe.get(entry.recipe_id) ?? [];
        const lines = ingredientsForRecipe(recipe, structured);

        if (lines.length === 0) {
          skippedMeals.push(entry.title || recipe?.name || 'Untitled meal');
          continue;
        }

        const scale =
          recipe?.servings && recipe.servings > 0 && householdSize > 0
            ? householdSize / recipe.servings
            : 1;

        for (const line of lines) {
          collected.push(scaleShoppingIngredient(line, scale));
        }
      }
    }

    const merged = mergeShoppingIngredients(collected);
    if (merged.length === 0) {
      return { status: 'empty', skippedMeals };
    }

    const list = await this.persistMergedList({
      scope: input.scope,
      weekStart: input.weekStart,
      existingId: existing?.id ?? null,
      skippedMeals,
      items: merged,
    });

    return {
      status: 'created',
      list,
      replaced: Boolean(existing),
    };
  }

  async toggleItem(
    scope: MealPlanScope,
    itemId: string,
    checked: boolean,
  ): Promise<void> {
    const db = loose(this.client);
    const { data: item, error: itemError } = await db
      .from('family_shopping_list_items')
      .select('id, list_id')
      .eq('id', itemId)
      .maybeSingle();

    if (itemError) throw itemError;
    if (!item) throw new Error('Item not found');

    const listId = String((item as { list_id: string }).list_id);
    const list = await this.requireListInScope(scope, listId);

    const { error } = await db
      .from('family_shopping_list_items')
      .update({ checked })
      .eq('id', itemId)
      .eq('list_id', list.id);

    if (error) throw error;
  }

  async addItem(
    scope: MealPlanScope,
    input: { listId?: string; weekStart?: string; text: string },
  ): Promise<ShoppingListItemRow> {
    const weekStart = input.weekStart;
    let list: ShoppingListRow | null = null;

    if (input.listId) {
      list = await this.requireListInScope(scope, input.listId);
    } else if (weekStart) {
      list = await this.findListForWeek(scope, weekStart);
    } else {
      const latest = await this.loadLatestList(scope);
      list = latest;
    }

    const parsed = parseAndMergeIngredientLines([input.text])[0];
    if (!parsed) {
      throw new Error('Could not add that item');
    }

    if (!list) {
      if (!weekStart) {
        throw new Error('No shopping list to add to');
      }
      const created = await this.persistMergedList({
        scope,
        weekStart,
        existingId: null,
        skippedMeals: [],
        items: [parsed],
      });
      const first = created.items[0];
      if (!first) throw new Error('Could not add that item');
      return first;
    }

    const existingItems = await this.loadItems(list.id);
    const nextOrder =
      existingItems.reduce((max, item) => Math.max(max, item.sort_order), -1) +
      1;
    const db = loose(this.client);
    const { data, error } = await db
      .from('family_shopping_list_items')
      .insert({
        list_id: list.id,
        sort_order: nextOrder,
        name: parsed.name,
        amount: parsed.amount,
        unit: parsed.unit,
        category: parsed.category,
        display_text: parsed.display_text,
        is_unparsed: parsed.is_unparsed,
        checked: false,
      })
      .select('*')
      .single();

    if (error) throw error;
    return mapItem(data as Record<string, unknown>);
  }

  private async requireListInScope(
    scope: MealPlanScope,
    listId: string,
  ): Promise<ShoppingListRow> {
    const db = loose(this.client);
    const { data, error } = await applyScope(
      db.from('family_shopping_lists').select('*').eq('id', listId),
      scope,
    ).maybeSingle();

    if (error) throw error;
    if (!data) throw new Error('Shopping list not found');
    return mapList(data as Record<string, unknown>);
  }

  private async loadWeekSources(
    scope: MealPlanScope,
    rangeStart: string,
    rangeEnd: string,
  ): Promise<{
    entries: MealEntryRow[];
    recipes: Map<string, RecipeRow>;
    structuredByRecipe: Map<string, ShoppingIngredientInput[]>;
    householdSize: number;
  }> {
    let entriesQuery = this.client
      .from('family_meal_plan_entries')
      .select('*')
      .gte('plan_date', rangeStart)
      .lte('plan_date', rangeEnd)
      .order('plan_date', { ascending: true });

    let recipesQuery = this.client.from('family_recipes').select('*');
    let prefsQuery = this.client
      .from('family_meal_preferences')
      .select('household_size');

    if (scope.kind === 'workspace') {
      entriesQuery = entriesQuery.eq('account_id', scope.accountId);
      recipesQuery = recipesQuery.eq('account_id', scope.accountId);
      prefsQuery = prefsQuery.eq('account_id', scope.accountId);
    } else {
      entriesQuery = entriesQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
      recipesQuery = recipesQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
      prefsQuery = prefsQuery
        .eq('user_id', scope.userId)
        .is('account_id', null);
    }

    const [entriesResult, recipesResult, prefsResult] = await Promise.all([
      entriesQuery,
      recipesQuery,
      prefsQuery.maybeSingle(),
    ]);

    if (entriesResult.error) throw entriesResult.error;
    if (recipesResult.error) throw recipesResult.error;
    if (prefsResult.error) throw prefsResult.error;

    const entries = (entriesResult.data ?? []) as MealEntryRow[];
    const recipes = new Map(
      ((recipesResult.data ?? []) as RecipeRow[]).map((recipe) => [
        recipe.id,
        recipe,
      ]),
    );

    const recipeIds = [
      ...new Set(
        entries
          .map((entry) => entry.recipe_id)
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const structuredByRecipe = new Map<string, ShoppingIngredientInput[]>();

    if (recipeIds.length > 0) {
      const { data: structured, error: structuredError } = await this.client
        .from('family_recipe_ingredients')
        .select('recipe_id, name, amount, unit, original_text, sort_order')
        .in('recipe_id', recipeIds)
        .order('sort_order', { ascending: true });

      if (structuredError) throw structuredError;

      for (const row of structured ?? []) {
        const r = row as {
          recipe_id: string;
          name: string;
          amount: number | string | null;
          unit: string | null;
          original_text: string;
        };
        const list = structuredByRecipe.get(r.recipe_id) ?? [];
        list.push({
          name: r.name || r.original_text,
          amount: asNumber(r.amount),
          unit: r.unit,
          original_text: r.original_text || r.name,
        });
        structuredByRecipe.set(r.recipe_id, list);
      }
    }

    const householdSize =
      asNumber(
        (prefsResult.data as { household_size?: number } | null)
          ?.household_size,
      ) ?? 2;

    return { entries, recipes, structuredByRecipe, householdSize };
  }

  private async persistMergedList(input: {
    scope: MealPlanScope;
    weekStart: string;
    existingId: string | null;
    skippedMeals: string[];
    items: Array<{
      name: string;
      amount: number | null;
      unit: string | null;
      category: ShoppingListCategory;
      display_text: string;
      is_unparsed: boolean;
    }>;
  }): Promise<ShoppingListWithItems> {
    const db = loose(this.client);
    const now = new Date().toISOString();
    const accountId =
      input.scope.kind === 'workspace' ? input.scope.accountId : null;

    let listId = input.existingId;
    const previousItems = listId ? await this.loadItems(listId) : [];

    if (listId) {
      const { error: updateError } = await db
        .from('family_shopping_lists')
        .update({
          skipped_meals: input.skippedMeals,
          generated_at: now,
        })
        .eq('id', listId);

      if (updateError) throw updateError;
    } else {
      const { data, error } = await db
        .from('family_shopping_lists')
        .insert({
          user_id: input.scope.userId,
          account_id: accountId,
          week_start: input.weekStart,
          skipped_meals: input.skippedMeals,
          generated_at: now,
        })
        .select('*')
        .single();

      if (error) throw error;
      listId = String((data as { id: string }).id);
    }

    const { data: inserted, error: insertError } = await db
      .from('family_shopping_list_items')
      .insert(
        input.items.map((item, index) => ({
          list_id: listId,
          sort_order: index,
          name: item.name,
          amount: item.amount,
          unit: item.unit,
          category: item.category,
          display_text: item.display_text,
          is_unparsed: item.is_unparsed,
          checked: false,
        })),
      )
      .select('*');

    if (insertError) throw insertError;

    if (previousItems.length > 0) {
      const { error: deleteError } = await db
        .from('family_shopping_list_items')
        .delete()
        .eq('list_id', listId)
        .in(
          'id',
          previousItems.map((item) => item.id),
        );

      if (deleteError) throw deleteError;
    }

    const { data: listRow, error: listError } = await db
      .from('family_shopping_lists')
      .select('*')
      .eq('id', listId)
      .single();

    if (listError) throw listError;

    return {
      ...mapList(listRow as Record<string, unknown>),
      items: ((inserted as Record<string, unknown>[] | null) ?? []).map(
        mapItem,
      ),
    };
  }
}

function ingredientsForRecipe(
  recipe: RecipeRow | undefined,
  structured: ShoppingIngredientInput[],
): ShoppingIngredientInput[] {
  const usableStructured = structured.filter(
    (line) => line.name.trim() || line.original_text.trim(),
  );
  if (usableStructured.length > 0) {
    return usableStructured;
  }

  const lines = recipe?.ingredients ?? [];
  return lines
    .map((line) => parseIngredientLine(line))
    .filter((line) => line.original_text)
    .map((line) => ({
      name: line.name || line.original_text,
      amount: line.amount,
      unit: line.unit,
      original_text: line.original_text,
    }));
}
