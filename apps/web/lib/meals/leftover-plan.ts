export function leftoverMealTitle(sourceTitle: string): string {
  const trimmed = sourceTitle.trim();
  if (!trimmed) return 'Leftovers';
  if (/^\s*leftovers\b/i.test(trimmed)) return trimmed;
  return `Leftovers: ${trimmed}`;
}

export function isLeftoverPlanEntry(entry: {
  title?: string | null;
  leftover_source_entry_id?: string | null;
}): boolean {
  if (entry.leftover_source_entry_id) return true;
  return /^\s*leftovers\b/i.test(entry.title ?? '');
}

/** Skip leftover slots when building a shopping list (ingredients already counted on the source cook). */
export function shouldSkipShoppingForMeal(entry: {
  title?: string | null;
  leftover_source_entry_id?: string | null;
}): boolean {
  return isLeftoverPlanEntry(entry);
}

export function nextEmptyDates(input: {
  sourceDate: string;
  weekDates: string[];
  occupiedDates: string[];
  count: number;
}): string[] {
  const occupied = new Set(input.occupiedDates);
  const after = input.weekDates.filter((date) => date > input.sourceDate);
  const picks: string[] = [];
  for (const date of after) {
    if (occupied.has(date)) continue;
    picks.push(date);
    if (picks.length >= input.count) break;
  }
  return picks;
}

export function suggestLeftoverDates(input: {
  sourceDate: string;
  weekDates: string[];
  occupiedDates: string[];
  count?: number;
}): string[] {
  return nextEmptyDates({
    ...input,
    count: input.count ?? 2,
  });
}

export type PlannedLeftoverSlot = {
  planDate: string;
  title: string;
  recipeId: string | null;
  leftoverSourceEntryId: string;
  isBatchPrep: false;
};

export function planLeftoverSlots(input: {
  source: {
    id: string;
    title: string;
    recipe_id?: string | null;
  };
  targetDates: string[];
}): PlannedLeftoverSlot[] {
  const title = leftoverMealTitle(input.source.title);
  const uniqueDates = [...new Set(input.targetDates)];
  return uniqueDates.map((planDate) => ({
    planDate,
    title,
    recipeId: input.source.recipe_id ?? null,
    leftoverSourceEntryId: input.source.id,
    isBatchPrep: false as const,
  }));
}
