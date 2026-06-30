import {
  DIETARY_OPTIONS,
  PRIORITY_OPTIONS,
  RECIPE_MEAL_TYPES,
  type RecipeMealType,
} from '../_lib/schema/family-meal.schema';

export const ACCENT = '#059669';

export const panelClass =
  'rounded-2xl border border-[color:var(--workspace-shell-border)] bg-[var(--workspace-shell-panel)] shadow-[0_12px_36px_rgba(4,10,24,0.18)]';

export const priorityChoices = PRIORITY_OPTIONS;
export const dietaryChoices = DIETARY_OPTIONS;
export const recipeMealTypes = RECIPE_MEAL_TYPES;

export const mealTypeLabels: Record<RecipeMealType, string> = {
  breakfast: 'Breakfast',
  lunch: 'Lunch',
  dinner: 'Dinner',
  snack: 'Snack',
  any: 'Any',
};

export function titleCase(value: string): string {
  return value
    .split(/[-\s]/)
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');
}

export function totalTimeLabel(
  prep: number | null,
  cook: number | null,
): string | null {
  const total = (prep ?? 0) + (cook ?? 0);
  if (total <= 0) return null;
  if (total < 60) return `${total} min`;
  const hours = Math.floor(total / 60);
  const mins = total % 60;
  return mins ? `${hours}h ${mins}m` : `${hours}h`;
}
