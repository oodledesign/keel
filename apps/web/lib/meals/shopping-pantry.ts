import { normaliseIngredientName } from '~/lib/meals/shopping-list-merge';

export function pantryMatchesIngredient(
  itemName: string,
  pantryName: string,
): boolean {
  const item = normaliseIngredientName(itemName);
  const pantry = normaliseIngredientName(pantryName);
  if (!item || !pantry) return false;
  if (item === pantry) return true;
  // Avoid "oil" matching every oil-based line — require a meaningful token.
  if (pantry.length >= 4 && item.includes(pantry)) return true;
  if (item.length >= 4 && pantry.includes(item)) return true;
  return false;
}

export function itemMatchesAnyPantry(
  itemName: string,
  pantryNames: string[],
): boolean {
  return pantryNames.some((name) => pantryMatchesIngredient(itemName, name));
}

export function applyPantryToShoppingItems<
  T extends { name: string; display_text?: string },
>(
  items: T[],
  pantryNames: string[],
): Array<T & { in_pantry: boolean }> {
  return items.map((item) => ({
    ...item,
    in_pantry: itemMatchesAnyPantry(
      item.name || item.display_text || '',
      pantryNames,
    ),
  }));
}
