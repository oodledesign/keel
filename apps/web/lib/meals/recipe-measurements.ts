/**
 * Parse free-text ingredient lines and format scaled / unit-converted amounts
 * for recipe detail (servings × step multiplier, metric/imperial toggle).
 */

export type MeasurementSystem = 'metric' | 'imperial';

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

export function formatAmount(value: number): string {
  if (!Number.isFinite(value)) return '';
  const rounded = Math.round(value * 100) / 100;
  return String(rounded);
}

export function convertAmountUnit(
  amount: number | null,
  unit: string | null,
  system: MeasurementSystem,
): { amount: number | null; unit: string | null } {
  if (amount == null || !unit) return { amount, unit };
  const normalised = normaliseUnit(unit);
  if (!normalised) return { amount, unit };

  if (system === 'imperial') {
    const conversion = METRIC_TO_IMPERIAL[normalised];
    if (!conversion) return { amount, unit: normalised };
    return {
      amount: amount * conversion.factor,
      unit: conversion.unit,
    };
  }

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
}): string {
  const multiplier = input.servingsScale * (input.quantityMultiplier ?? 1);

  if (input.amount == null) {
    return input.name || input.original_text;
  }

  const scaled = input.amount * multiplier;
  const converted = convertAmountUnit(scaled, input.unit, input.system);
  const amountLabel = formatAmount(converted.amount ?? scaled);
  const unitLabel = converted.unit ? ` ${converted.unit}` : '';
  return `${amountLabel}${unitLabel} ${input.name}`.trim();
}

const INGREDIENT_TOKEN_RE =
  /\{([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})\}/gi;

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
}): string {
  return input.content.replace(INGREDIENT_TOKEN_RE, (_match, id: string) => {
    const ingredient = input.ingredientsById.get(id);
    if (!ingredient) return '…';
    return formatIngredientDisplay({
      ...ingredient,
      servingsScale: input.servingsScale,
      quantityMultiplier: input.stepMultipliers.get(id) ?? 1,
      system: input.system,
    });
  });
}
