/**
 * Parse free-text ingredient lines and format scaled / unit-converted amounts
 * for recipe detail (servings × step multiplier, unit system toggle).
 */

export type MeasurementSystem = 'metric' | 'imperial' | 'cups';

export type ParsedIngredientLine = {
  name: string;
  amount: number | null;
  unit: string | null;
  original_text: string;
};

const UNIT_ALIASES: Record<string, string> = {
  g: 'g',
  gram: 'g',
  grams: 'g',
  kg: 'kg',
  kilogram: 'kg',
  kilograms: 'kg',
  ml: 'ml',
  millilitre: 'ml',
  millilitres: 'ml',
  milliliter: 'ml',
  milliliters: 'ml',
  l: 'l',
  litre: 'l',
  litres: 'l',
  liter: 'l',
  liters: 'l',
  oz: 'oz',
  ounce: 'oz',
  ounces: 'oz',
  lb: 'lb',
  lbs: 'lb',
  pound: 'lb',
  pounds: 'lb',
  'fl oz': 'fl oz',
  floz: 'fl oz',
  cup: 'cup',
  cups: 'cup',
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
};

const METRIC_TO_IMPERIAL: Record<string, { unit: string; factor: number }> = {
  g: { unit: 'oz', factor: 1 / 28.3495 },
  kg: { unit: 'lb', factor: 2.20462 },
  ml: { unit: 'fl oz', factor: 1 / 29.5735 },
  l: { unit: 'fl oz', factor: 33.814 },
};

const IMPERIAL_TO_METRIC: Record<string, { unit: string; factor: number }> = {
  oz: { unit: 'g', factor: 28.3495 },
  lb: { unit: 'kg', factor: 1 / 2.20462 },
  'fl oz': { unit: 'ml', factor: 29.5735 },
  cup: { unit: 'ml', factor: 240 },
};

const ML_PER_UNIT: Record<string, number> = {
  ml: 1,
  l: 1000,
  'fl oz': 29.5735,
  cup: 240,
  tbsp: 15,
  tsp: 5,
};

const MASS_UNITS = new Set(['g', 'kg', 'oz', 'lb']);

function normaliseUnit(unit: string | null | undefined): string | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\./g, '');
  return UNIT_ALIASES[key] ?? unit.trim().toLowerCase();
}

export function parseIngredientLine(line: string): ParsedIngredientLine {
  const original_text = line.trim();
  if (!original_text) {
    return { name: '', amount: null, unit: null, original_text: '' };
  }

  // "200g pasta", "2 tbsp olive oil", "1/2 cup flour", "1½ tsp salt"
  const match = original_text.match(
    /^(\d+(?:[./]\d+)?|\d+\s+\d+\/\d+)\s*([a-zA-Zμµ.]+(?:\s*oz)?)\s+(.+)$/i,
  );

  if (!match) {
    const bareAmount = original_text.match(/^(\d+(?:[./]\d+)?)\s+(.+)$/);
    if (bareAmount?.[1] && bareAmount[2]) {
      return {
        name: bareAmount[2].trim(),
        amount: parseAmount(bareAmount[1]),
        unit: null,
        original_text,
      };
    }
    return {
      name: original_text,
      amount: null,
      unit: null,
      original_text,
    };
  }

  return {
    amount: parseAmount(match[1]!),
    unit: normaliseUnit(match[2]!),
    name: match[3]!.trim(),
    original_text,
  };
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.trim().replace(',', '.');
  if (cleaned.includes('/')) {
    const mixed = cleaned.match(/^(\d+)\s+(\d+)\/(\d+)$/);
    if (mixed) {
      const whole = Number(mixed[1]);
      const num = Number(mixed[2]);
      const den = Number(mixed[3]);
      if (den) return whole + num / den;
    }
    const [num, den] = cleaned.split('/').map(Number);
    if (num && den) return num / den;
  }
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function formatAmount(
  value: number,
  system?: MeasurementSystem,
): string {
  if (!Number.isFinite(value)) return '';

  if (system === 'cups') {
    const fraction = nearestCookingFraction(value);
    if (fraction) return fraction;
  }

  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

/** Prefer readable kitchen fractions for cups/spoons. */
function nearestCookingFraction(value: number): string | null {
  const wholes = Math.floor(value + 1e-9);
  const frac = value - wholes;
  const candidates: Array<{ label: string; value: number }> = [
    { label: '', value: 0 },
    { label: '1/8', value: 0.125 },
    { label: '1/4', value: 0.25 },
    { label: '1/3', value: 1 / 3 },
    { label: '3/8', value: 0.375 },
    { label: '1/2', value: 0.5 },
    { label: '5/8', value: 0.625 },
    { label: '2/3', value: 2 / 3 },
    { label: '3/4', value: 0.75 },
    { label: '7/8', value: 0.875 },
  ];

  let best = candidates[0]!;
  let bestDelta = Math.abs(frac - best.value);
  for (const candidate of candidates.slice(1)) {
    const delta = Math.abs(frac - candidate.value);
    if (delta < bestDelta) {
      best = candidate;
      bestDelta = delta;
    }
  }

  // Only use a fraction when it is close enough; otherwise fall back to decimal.
  if (bestDelta > 0.04) return null;

  if (wholes === 0) {
    return best.label || '0';
  }
  if (!best.label) return String(wholes);
  return `${wholes} ${best.label}`;
}

function volumeToCupsSpoons(ml: number): { amount: number; unit: string } {
  const abs = Math.abs(ml);
  if (abs >= 60) {
    return { amount: ml / 240, unit: 'cup' };
  }
  if (abs >= 12) {
    return { amount: ml / 15, unit: 'tbsp' };
  }
  return { amount: ml / 5, unit: 'tsp' };
}

export function convertAmountUnit(
  amount: number | null,
  unit: string | null,
  system: MeasurementSystem,
): { amount: number | null; unit: string | null } {
  if (amount == null || !unit) return { amount, unit };
  const normalised = normaliseUnit(unit);
  if (!normalised) return { amount, unit };

  if (system === 'cups') {
    if (MASS_UNITS.has(normalised)) {
      // Keep mass in metric for the cups/spoons cooking view.
      if (normalised === 'oz') {
        return { amount: amount * 28.3495, unit: 'g' };
      }
      if (normalised === 'lb') {
        return { amount: amount / 2.20462, unit: 'kg' };
      }
      return { amount, unit: normalised };
    }

    const mlFactor = ML_PER_UNIT[normalised];
    if (mlFactor) {
      return volumeToCupsSpoons(amount * mlFactor);
    }
    return { amount, unit: normalised };
  }

  if (system === 'imperial') {
    const conversion = METRIC_TO_IMPERIAL[normalised];
    if (!conversion) return { amount, unit: normalised };
    return {
      amount: amount * conversion.factor,
      unit: conversion.unit,
    };
  }

  // Metric: convert imperial / cup measures into metric.
  const conversion = IMPERIAL_TO_METRIC[normalised];
  if (!conversion) return { amount, unit: normalised };
  return {
    amount: amount * conversion.factor,
    unit: conversion.unit,
  };
}

export function formatIngredientDisplay(input: {
  name: string;
  amount: number | null;
  unit: string | null;
  original_text: string;
  servingsScale: number;
  quantityMultiplier?: number;
  system: MeasurementSystem;
  /** When false, only the ingredient name is shown (for method text without amounts). */
  includeAmount?: boolean;
}): string {
  const includeAmount = input.includeAmount !== false;
  const name = input.name || input.original_text;

  if (!includeAmount || input.amount == null) {
    return name;
  }

  const multiplier = input.servingsScale * (input.quantityMultiplier ?? 1);
  const scaled = input.amount * multiplier;
  const converted = convertAmountUnit(scaled, input.unit, input.system);
  const amountLabel = formatAmount(converted.amount ?? scaled, input.system);
  const unitLabel = converted.unit ? ` ${converted.unit}` : '';
  return `${amountLabel}${unitLabel} ${name}`.trim();
}

const INGREDIENT_TOKEN_RE =
  /\{([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\}/gi;

export function contentHasIngredientTokens(content: string): boolean {
  return /\{[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}/i.test(
    content,
  );
}

export function extractIngredientTokenIds(content: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  INGREDIENT_TOKEN_RE.lastIndex = 0;
  for (const match of content.matchAll(INGREDIENT_TOKEN_RE)) {
    const id = match[1]?.toLowerCase();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    ids.push(id);
  }
  return ids;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function nameMatchVariants(name: string): string[] {
  const trimmed = name.trim();
  if (!trimmed) return [];
  const withoutParens = trimmed.replace(/\s*\([^)]*\)\s*/g, ' ').trim();
  const withoutOr = withoutParens.replace(/\s+or\s+.+$/i, '').trim();
  return [...new Set([trimmed, withoutParens, withoutOr].filter(Boolean))];
}

/**
 * Replace plain ingredient name mentions with `{uuid}` tokens (longest names first).
 * Leaves existing tokens untouched.
 */
export function tokeniseIngredientMentions(
  content: string,
  ingredients: Array<{ id: string; name: string }>,
): { content: string; ingredientIds: string[] } {
  if (!content.trim() || ingredients.length === 0) {
    return { content, ingredientIds: [] };
  }

  const candidates = ingredients
    .flatMap((ingredient) =>
      nameMatchVariants(ingredient.name).map((variant) => ({
        id: ingredient.id,
        variant,
      })),
    )
    .filter((item) => item.variant.length >= 2)
    .sort((a, b) => b.variant.length - a.variant.length);

  // Protect existing tokens so we do not match inside them.
  const protectedTokens: string[] = [];
  let working = content.replace(INGREDIENT_TOKEN_RE, (token) => {
    const index = protectedTokens.length;
    protectedTokens.push(token);
    return `\u0000TOKEN${index}\u0000`;
  });

  const usedIds = new Set<string>();

  for (const candidate of candidates) {
    const pattern = new RegExp(
      `(?<![\\w])${escapeRegExp(candidate.variant)}(?![\\w])`,
      'gi',
    );
    if (!pattern.test(working)) continue;
    pattern.lastIndex = 0;
    working = working.replace(pattern, `{${candidate.id}}`);
    usedIds.add(candidate.id);
  }

  const restored = working.replace(
    /\u0000TOKEN(\d+)\u0000/g,
    (_match, index) => {
      return protectedTokens[Number(index)] ?? '';
    },
  );

  // Include any tokens that were already present.
  for (const id of extractIngredientTokenIds(restored)) {
    usedIds.add(id);
  }

  return {
    content: restored,
    ingredientIds: [...usedIds],
  };
}

export function renderStepContent(input: {
  content: string;
  ingredientsById: Map<
    string,
    {
      name: string;
      amount: number | null;
      unit: string | null;
      original_text: string;
    }
  >;
  stepMultipliers: Map<string, number>;
  servingsScale: number;
  system: MeasurementSystem;
  includeAmount?: boolean;
}): string {
  return input.content.replace(INGREDIENT_TOKEN_RE, (_match, id: string) => {
    const ingredient = input.ingredientsById.get(id);
    if (!ingredient) return '…';
    return formatIngredientDisplay({
      ...ingredient,
      servingsScale: input.servingsScale,
      quantityMultiplier: input.stepMultipliers.get(id) ?? 1,
      system: input.system,
      includeAmount: input.includeAmount,
    });
  });
}
