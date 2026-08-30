import { parseIngredientLine } from '~/lib/meals/recipe-measurements';

export const SHOPPING_CATEGORIES = [
  'produce',
  'meat_fish',
  'dairy',
  'store_cupboard',
  'other',
] as const;

export type ShoppingCategory = (typeof SHOPPING_CATEGORIES)[number];

export type ShoppingIngredientInput = {
  name: string;
  amount: number | null;
  unit: string | null;
  original_text: string;
};

export type MergedShoppingItem = {
  name: string;
  amount: number | null;
  unit: string | null;
  category: ShoppingCategory;
  display_text: string;
  is_unparsed: boolean;
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
  tbsp: 'tbsp',
  tablespoon: 'tbsp',
  tablespoons: 'tbsp',
  tsp: 'tsp',
  teaspoon: 'tsp',
  teaspoons: 'tsp',
  cup: 'cup',
  cups: 'cup',
};

const NAME_SYNONYMS: Record<string, string> = {
  'extra virgin olive oil': 'olive oil',
  evoo: 'olive oil',
  'virgin olive oil': 'olive oil',
  cilantro: 'coriander',
  eggplant: 'aubergine',
  zucchini: 'courgette',
  'green onion': 'spring onion',
  scallion: 'spring onion',
  'garbanzo bean': 'chickpea',
  garbanzo: 'chickpea',
  'ground beef': 'beef mince',
  'minced beef': 'beef mince',
  'bell pepper': 'pepper',
  capsicum: 'pepper',
};

const IRREGULAR_SINGULAR: Record<string, string> = {
  leaves: 'leaf',
  mice: 'mouse',
  geese: 'goose',
  cloves: 'clove',
};

const CATEGORY_KEYWORDS: Record<
  Exclude<ShoppingCategory, 'other'>,
  string[]
> = {
  meat_fish: [
    'chicken',
    'beef',
    'pork',
    'lamb',
    'turkey',
    'duck',
    'bacon',
    'sausage',
    'mince',
    'steak',
    'ham',
    'salmon',
    'tuna',
    'cod',
    'haddock',
    'prawn',
    'shrimp',
    'fish',
    'seafood',
    'anchovy',
    'mackerel',
    'trout',
    'chorizo',
  ],
  dairy: [
    'milk',
    'butter',
    'cheese',
    'cream',
    'yoghurt',
    'yogurt',
    'creme fraiche',
    'crème fraîche',
    'sour cream',
    'mozzarella',
    'parmesan',
    'cheddar',
    'feta',
    'ricotta',
    'egg',
    'eggs',
  ],
  produce: [
    'onion',
    'garlic',
    'tomato',
    'potato',
    'carrot',
    'celery',
    'pepper',
    'chilli',
    'chili',
    'lettuce',
    'spinach',
    'kale',
    'cabbage',
    'broccoli',
    'cauliflower',
    'courgette',
    'aubergine',
    'leek',
    'shallot',
    'ginger',
    'lemon',
    'lime',
    'apple',
    'banana',
    'orange',
    'berry',
    'mushroom',
    'avocado',
    'cucumber',
    'parsley',
    'coriander',
    'basil',
    'mint',
    'thyme',
    'rosemary',
    'spring onion',
    'salad',
    'rocket',
    'beetroot',
    'parsnip',
    'pea',
    'green bean',
    'sweetcorn',
    'squash',
    'pumpkin',
    'herb',
  ],
  store_cupboard: [
    'olive oil',
    'oil',
    'flour',
    'sugar',
    'salt',
    'pepper',
    'rice',
    'pasta',
    'noodle',
    'stock',
    'sauce',
    'vinegar',
    'soy',
    'cumin',
    'paprika',
    'turmeric',
    'cinnamon',
    'honey',
    'mustard',
    'ketchup',
    'chickpea',
    'lentil',
    'passata',
    'coconut milk',
    'tomato puree',
    'bread',
    'wrap',
    'oat',
    'spice',
    'baking powder',
    'yeast',
  ],
};

export const SHOPPING_CATEGORY_ORDER: ShoppingCategory[] = [
  'produce',
  'meat_fish',
  'dairy',
  'store_cupboard',
  'other',
];

export const SHOPPING_CATEGORY_LABELS: Record<ShoppingCategory, string> = {
  produce: 'Produce',
  meat_fish: 'Meat/fish',
  dairy: 'Dairy',
  store_cupboard: 'Store cupboard',
  other: 'Other',
};

export function normaliseShoppingUnit(
  unit: string | null | undefined,
): string | null {
  if (!unit) return null;
  const key = unit.trim().toLowerCase().replace(/\./g, '');
  return UNIT_ALIASES[key] ?? unit.trim().toLowerCase();
}

function collapseSpaces(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function singulariseWord(word: string): string {
  const lower = word.toLowerCase();
  if (IRREGULAR_SINGULAR[lower]) return IRREGULAR_SINGULAR[lower];
  if (lower.endsWith('ies') && lower.length > 4) {
    return `${lower.slice(0, -3)}y`;
  }
  if (
    (lower.endsWith('oes') ||
      lower.endsWith('ses') ||
      lower.endsWith('xes') ||
      lower.endsWith('ches') ||
      lower.endsWith('shes')) &&
    lower.length > 4
  ) {
    return lower.slice(0, -2);
  }
  if (lower.endsWith('s') && !lower.endsWith('ss') && lower.length > 3) {
    return lower.slice(0, -1);
  }
  return lower;
}

function singulariseName(name: string): string {
  const words = collapseSpaces(name).split(' ');
  const last = words[words.length - 1];
  if (!last) return collapseSpaces(name).toLowerCase();
  words[words.length - 1] = singulariseWord(last);
  return words.join(' ').toLowerCase();
}

function applySynonym(name: string): string {
  return NAME_SYNONYMS[name] ?? name;
}

export function normaliseIngredientName(name: string): string {
  const stripped = collapseSpaces(name)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^the\s+/i, '')
    .trim();
  return applySynonym(singulariseName(stripped));
}

function prettyName(name: string): string {
  return collapseSpaces(name)
    .replace(/\s*\([^)]*\)\s*/g, ' ')
    .replace(/^the\s+/i, '')
    .trim();
}

function pluraliseWord(word: string): string {
  const lower = word.toLowerCase();
  if (lower.endsWith('s')) return word;
  if (lower.endsWith('y') && !/[aeiou]y$/i.test(lower)) {
    return `${word.slice(0, -1)}ies`;
  }
  if (
    /(?:ch|sh|x|z|s)$/i.test(lower) ||
    /(?:tomato|potato|hero)$/i.test(lower)
  ) {
    return `${word}es`;
  }
  return `${word}s`;
}

function displayNameForCount(
  name: string,
  amount: number | null,
  unit: string | null,
) {
  const pretty = prettyName(name);
  if (unit || amount == null || Math.abs(amount - 1) < 1e-9) {
    return pretty;
  }
  const words = pretty.split(' ');
  const last = words[words.length - 1];
  if (!last) return pretty;
  words[words.length - 1] = pluraliseWord(last);
  return words.join(' ');
}

export function formatShoppingQuantity(amount: number): string {
  if (!Number.isFinite(amount)) return '';
  const rounded = Math.round(amount * 100) / 100;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

function toCanonicalMassOrVolume(
  amount: number,
  unit: string | null,
): { amount: number; unit: string | null } {
  if (unit === 'kg') return { amount: amount * 1000, unit: 'g' };
  if (unit === 'l') return { amount: amount * 1000, unit: 'ml' };
  return { amount, unit };
}

function fromCanonicalMassOrVolume(
  amount: number,
  unit: string | null,
): { amount: number; unit: string | null } {
  if (unit === 'g' && amount >= 1000) {
    return { amount: amount / 1000, unit: 'kg' };
  }
  if (unit === 'ml' && amount >= 1000) {
    return { amount: amount / 1000, unit: 'l' };
  }
  return { amount, unit };
}

export function categoriseIngredient(name: string): ShoppingCategory {
  const haystack = ` ${normaliseIngredientName(name)} `;
  for (const category of SHOPPING_CATEGORY_ORDER) {
    if (category === 'other') continue;
    for (const keyword of CATEGORY_KEYWORDS[category]) {
      if (
        haystack.includes(` ${keyword} `) ||
        haystack.includes(` ${singulariseName(keyword)} `)
      ) {
        return category;
      }
    }
  }
  return 'other';
}

export function formatShoppingDisplay(input: {
  name: string;
  amount: number | null;
  unit: string | null;
  original_text: string;
  is_unparsed: boolean;
}): string {
  if (input.is_unparsed) {
    return input.original_text.trim() || input.name;
  }

  if (input.amount == null) {
    return prettyName(input.name) || input.original_text;
  }

  const pretty = fromCanonicalMassOrVolume(input.amount, input.unit);
  const amountLabel = formatShoppingQuantity(pretty.amount);
  const unitLabel = pretty.unit ? ` ${pretty.unit}` : '';
  const name = displayNameForCount(input.name, pretty.amount, pretty.unit);
  return `${amountLabel}${unitLabel} ${name}`.trim();
}

function isUnparsedLine(input: ShoppingIngredientInput): boolean {
  const name = collapseSpaces(input.name);
  const original = collapseSpaces(input.original_text);
  if (!name && !original) return true;
  if (input.amount != null) return false;
  // Sentences / instructions are left as their own rows.
  return /[,;]|\bto taste\b|\bhandful\b|\bpinch\b|\bjuice of\b|\boptional\b/i.test(
    original || name,
  );
}

export function mergeShoppingIngredients(
  inputs: ShoppingIngredientInput[],
): MergedShoppingItem[] {
  type Bucket = {
    name: string;
    amount: number | null;
    unit: string | null;
    original_text: string;
    is_unparsed: boolean;
  };

  const buckets = new Map<string, Bucket>();

  for (const input of inputs) {
    const original = collapseSpaces(input.original_text || input.name);
    if (!original) continue;

    const unparsed = isUnparsedLine(input);
    const unit = unparsed ? null : normaliseShoppingUnit(input.unit);
    const name = prettyName(input.name) || original;
    const keyName = unparsed
      ? collapseSpaces(original).toLowerCase()
      : normaliseIngredientName(name);
    const canonical =
      !unparsed && input.amount != null
        ? toCanonicalMassOrVolume(input.amount, unit)
        : { amount: input.amount, unit };

    const key = unparsed
      ? `unparsed::${keyName}`
      : `${keyName}::${canonical.unit ?? ''}`;

    const existing = buckets.get(key);
    if (!existing) {
      buckets.set(key, {
        name,
        amount: canonical.amount,
        unit: canonical.unit,
        original_text: original,
        is_unparsed: unparsed,
      });
      continue;
    }

    if (
      !unparsed &&
      existing.amount != null &&
      canonical.amount != null &&
      existing.unit === canonical.unit
    ) {
      existing.amount += canonical.amount;
    }
  }

  const merged = [...buckets.values()].map((bucket) => {
    const pretty =
      bucket.amount != null
        ? fromCanonicalMassOrVolume(bucket.amount, bucket.unit)
        : { amount: bucket.amount, unit: bucket.unit };

    const item: MergedShoppingItem = {
      name: prettyName(bucket.name),
      amount: pretty.amount,
      unit: pretty.unit,
      category: bucket.is_unparsed
        ? 'other'
        : categoriseIngredient(bucket.name),
      display_text: formatShoppingDisplay({
        name: bucket.name,
        amount: pretty.amount,
        unit: pretty.unit,
        original_text: bucket.original_text,
        is_unparsed: bucket.is_unparsed,
      }),
      is_unparsed: bucket.is_unparsed,
    };
    return item;
  });

  merged.sort((a, b) => {
    const categoryDelta =
      SHOPPING_CATEGORY_ORDER.indexOf(a.category) -
      SHOPPING_CATEGORY_ORDER.indexOf(b.category);
    if (categoryDelta !== 0) return categoryDelta;
    return a.display_text.localeCompare(b.display_text, 'en-GB');
  });

  return merged;
}

export function parseAndMergeIngredientLines(
  lines: string[],
): MergedShoppingItem[] {
  return mergeShoppingIngredients(
    lines
      .map((line) => parseIngredientLine(line))
      .filter((line) => line.original_text)
      .map((line) => ({
        name: line.name || line.original_text,
        amount: line.amount,
        unit: line.unit,
        original_text: line.original_text,
      })),
  );
}

export function scaleShoppingIngredient(
  input: ShoppingIngredientInput,
  scale: number,
): ShoppingIngredientInput {
  if (input.amount == null || !Number.isFinite(scale) || scale === 1) {
    return input;
  }
  return {
    ...input,
    amount: input.amount * scale,
  };
}
