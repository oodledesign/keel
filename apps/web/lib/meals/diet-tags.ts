/**
 * Free deterministic vegetarian/vegan flags from ingredient text.
 * Keyword pass wins over Edamam when they disagree on these two tags.
 */

const NON_VEGETARIAN_PATTERNS: RegExp[] = [
  /\bchicken\b/i,
  /\bturkey\b/i,
  /\bduck\b/i,
  /\bgoose\b/i,
  /\bbeef\b/i,
  /\bsteak\b/i,
  /\bveal\b/i,
  /\bpork\b/i,
  /\bbacon\b/i,
  /\bham\b/i,
  /\bsausages?\b/i,
  /\blamb\b/i,
  /\bmutton\b/i,
  /\bvenison\b/i,
  /\bmeat\b/i,
  /\bminced\s+(?:beef|pork|lamb|turkey|chicken)\b/i,
  /\bgelatine\b/i,
  /\bgelatin\b/i,
  /\bfish\b/i,
  /\bsalmon\b/i,
  /\btuna\b/i,
  /\bcod\b/i,
  /\bhaddock\b/i,
  /\bmackerel\b/i,
  /\bsardines?\b/i,
  /\banchov(?:y|ies)\b/i,
  /\bprawns?\b/i,
  /\bshrimps?\b/i,
  /\bcrabs?\b/i,
  /\blobsters?\b/i,
  /\bmussels?\b/i,
  /\boysters?\b/i,
  /\bclams?\b/i,
  /\bsquids?\b/i,
  /\bcalamari\b/i,
  /\bfish\s*sauce\b/i,
  /\boyster\s*sauce\b/i,
  /\bworcestershire\b/i,
  /\blard\b/i,
  /\btallow\b/i,
  /\bchorizo\b/i,
  /\bprosciutto\b/i,
  /\bpancetta\b/i,
];

const NON_VEGAN_EXTRA_PATTERNS: RegExp[] = [
  /\bhoney\b/i,
  /\begg\b/i,
  /\beggs\b/i,
  /\bmilk\b/i,
  /\bbutter\b/i,
  /\bcheese\b/i,
  /\bcream\b/i,
  /\byoghurt\b/i,
  /\byogurt\b/i,
  /\bwhey\b/i,
  /\bcasein\b/i,
  /\bghee\b/i,
  /\bcottage\s*cheese\b/i,
  /\bricotta\b/i,
  /\bparmesan\b/i,
  /\bmayonnaise\b/i,
  /\bcustard\b/i,
];

export type KeywordDietFlags = {
  vegetarian: boolean;
  vegan: boolean;
};

export function detectKeywordDietFlags(
  ingredients: string[],
): KeywordDietFlags {
  const text = ingredients.join('\n');
  const hasMeatOrFish = NON_VEGETARIAN_PATTERNS.some((pattern) =>
    pattern.test(text),
  );
  const hasAnimalProduct =
    hasMeatOrFish ||
    NON_VEGAN_EXTRA_PATTERNS.some((pattern) => pattern.test(text));

  return {
    vegetarian: !hasMeatOrFish,
    vegan: !hasAnimalProduct,
  };
}

/** Normalise Edamam diet/health labels into short lowercase tags. */
export function normaliseEdamamLabel(label: string): string | null {
  const raw = label.trim().toLowerCase().replace(/_/g, '-');
  if (!raw) return null;

  const aliases: Record<string, string> = {
    vegetarian: 'vegetarian',
    vegan: 'vegan',
    pescatarian: 'pescatarian',
    'gluten-free': 'gluten-free',
    'dairy-free': 'dairy-free',
    'peanut-free': 'nut-free',
    'tree-nut-free': 'nut-free',
    'low-carb': 'low-carb',
    'low-fat': 'low-fat',
    'low-sodium': 'low-sodium',
    'low-sugar': 'low-sugar',
    keto: 'keto-friendly',
    'keto-friendly': 'keto-friendly',
    paleo: 'paleo',
    'high-protein': 'high-protein',
    'high-fiber': 'high-fibre',
    'high-fibre': 'high-fibre',
  };

  if (aliases[raw]) return aliases[raw]!;

  // Keep a short allowlist of useful health/diet labels; drop noise.
  const allowed = new Set([
    'vegetarian',
    'vegan',
    'pescatarian',
    'gluten-free',
    'dairy-free',
    'nut-free',
    'low-carb',
    'low-fat',
    'low-sodium',
    'low-sugar',
    'keto-friendly',
    'paleo',
    'high-protein',
    'high-fibre',
    'mediterranean',
    'kosher',
    'halal',
  ]);

  return allowed.has(raw) ? raw : null;
}

/**
 * Merge Edamam labels with the keyword vegetarian/vegan pass.
 * Keyword pass always wins on vegetarian/vegan disagreement.
 */
export function mergeDietTags(input: {
  keyword: KeywordDietFlags;
  edamamLabels: string[];
}): string[] {
  const fromEdamam = new Set<string>();
  for (const label of input.edamamLabels) {
    const normalised = normaliseEdamamLabel(label);
    if (normalised) fromEdamam.add(normalised);
  }

  fromEdamam.delete('vegetarian');
  fromEdamam.delete('vegan');

  if (input.keyword.vegan) {
    fromEdamam.add('vegan');
    fromEdamam.add('vegetarian');
  } else if (input.keyword.vegetarian) {
    fromEdamam.add('vegetarian');
  }

  return [...fromEdamam].sort((a, b) => a.localeCompare(b));
}
